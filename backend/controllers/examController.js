import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Exam from "../models/Exam.js";
import Course from "../models/Course.js";
import Score from "../models/Score.js";
import StudentExamResult from "../models/StudentExamResult.js";
import { pdfToPng } from "../utils/pdfToPng.js";
import { detectMarkers } from "../utils/markerDetect.js";
import { warpAndDefineROIs, cropROI } from "../utils/roiCrop.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const template = JSON.parse(fs.readFileSync(join(__dirname, "../utils/questionTemplate.json"), "utf-8"));
import sharp from "sharp";
import {
  extractNumberFromImage,
  extractStudentIdFromImage,
} from "../utils/geminiVision.js";

// Helper: derive PO contributions from Exam → ÖÇ mapping
const derivePCFromExam = (exam, course) => {
  const poMap = new Map();
  const loMap = new Map(
    (course.learningOutcomes || []).map((lo) => [lo.code, lo.relatedProgramOutcomes || []])
  );

  (exam.questions || []).forEach((q) => {
    const relatedPOs = loMap.get(q.learningOutcomeCode) || [];
    relatedPOs.forEach((poCode) => {
      if (!poMap.has(poCode)) {
        poMap.set(poCode, { code: poCode, fromQuestions: new Set() });
      }
      poMap.get(poCode).fromQuestions.add(q.questionNumber);
    });
  });

  return Array.from(poMap.values()).map((item) => ({
    code: item.code,
    questionNumbers: Array.from(item.fromQuestions),
  }));
};

// Yardımcı: temp dosya kaydet
const saveTempImage = (buffer, filename) => {
  const tempDir = path.join(process.cwd(), "temp", "exam_crops");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

// Yardımcı: Soru bölgelerini kes (marker varsa warp ile, yoksa template fallback)
const cropQuestionRegions = async (pngBuffer, markers) => {
  // Marker başarıyla bulunmuşsa warp + questionScoreBoxes
  if (markers?.success) {
    const { warpedImage, questionScoreBoxes } = await warpAndDefineROIs(pngBuffer, markers);
    const crops = [];
    for (const box of questionScoreBoxes) {
      const buf = await cropROI(warpedImage, box);
      const filePath = saveTempImage(buf, `q${box.number}_${Date.now()}.png`);
      crops.push({
        questionNumber: box.number,
        buffer: buf,
        imagePath: filePath,
      });
    }
    return crops;
  }

  // Fallback: template koordinatları ile orijinal PNG üzerinden kes
  // Önce görüntü boyutlarını al
  const imageMetadata = await sharp(pngBuffer).metadata();
  const imageWidth = imageMetadata.width || 0;
  const imageHeight = imageMetadata.height || 0;

  console.log(`📄 Şablon modu aktif - Görüntü boyutu: ${imageWidth}x${imageHeight}px`);
  console.log(`📋 Template referans boyutu: ${template.templateSize?.width || 2480}x${template.templateSize?.height || 3508}px`);

  const fallbackBoxes = template.questionScoreBoxes || [];
  const crops = [];
  
  for (const box of fallbackBoxes) {
    try {
      // Yüzde bazlı koordinatları kullan (her görüntü boyutunda çalışır)
      let left, top, width, height;
      
      if (box.xPercent !== undefined && box.yPercent !== undefined) {
        // Yüzde bazlı koordinatlar varsa onları kullan
        left = Math.round((box.xPercent / 100) * imageWidth);
        top = Math.round((box.yPercent / 100) * imageHeight);
        width = Math.round((box.wPercent / 100) * imageWidth);
        height = Math.round((box.hPercent / 100) * imageHeight);
        console.log(`   📊 Soru ${box.number} yüzde koordinatları: x=${box.xPercent}%, y=${box.yPercent}%, w=${box.wPercent}%, h=${box.hPercent}%`);
        console.log(`   📐 Soru ${box.number} pixel koordinatları: left=${left}, top=${top}, width=${width}, height=${height}`);
      } else if (box.x !== undefined && box.y !== undefined) {
        // Pixel bazlı koordinatlar varsa ölçeklendir (2480x3508 referans alınarak)
        const templateWidth = template.templateSize?.width || 2480;
        const templateHeight = template.templateSize?.height || 3508;
        const scaleX = imageWidth / templateWidth;
        const scaleY = imageHeight / templateHeight;
        left = Math.round(box.x * scaleX);
        top = Math.round(box.y * scaleY);
        width = Math.round(box.w * scaleX);
        height = Math.round(box.h * scaleY);
      } else {
        throw new Error(`Soru ${box.number} için geçerli koordinat bulunamadı`);
      }

      // Koordinatları görüntü sınırları içinde tut
      left = Math.max(0, Math.min(left, imageWidth - 1));
      top = Math.max(0, Math.min(top, imageHeight - 1));
      width = Math.max(1, Math.min(width, imageWidth - left));
      height = Math.max(1, Math.min(height, imageHeight - top));

      // Geçerlilik kontrolü
      if (width <= 0 || height <= 0 || left < 0 || top < 0 || 
          left + width > imageWidth || top + height > imageHeight) {
        console.warn(`⚠️ Soru ${box.number} için geçersiz koordinatlar: left=${left}, top=${top}, width=${width}, height=${height}, imageSize=${imageWidth}x${imageHeight}`);
        // Geçersiz koordinatlar için boş bir görüntü oluştur
        const emptyBuf = await sharp({
          create: {
            width: Math.max(1, width),
            height: Math.max(1, height),
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        }).png().toBuffer();
        const filePath = saveTempImage(emptyBuf, `q${box.number}_${Date.now()}.png`);
        crops.push({
          questionNumber: box.number,
          buffer: emptyBuf,
          imagePath: filePath,
        });
        continue;
      }

      // Debug: Koordinatları logla
      console.log(`📐 Soru ${box.number} kesiliyor: left=${left}, top=${top}, width=${width}, height=${height}, imageSize=${imageWidth}x${imageHeight}`);

      const buf = await sharp(pngBuffer)
        .extract({ left, top, width, height })
        .png()
        .toBuffer();
      
      // Kesilen görüntünün boyutunu kontrol et
      const cropMetadata = await sharp(buf).metadata();
      console.log(`✅ Soru ${box.number} kesildi: ${cropMetadata.width}x${cropMetadata.height}px`);
      
      const filePath = saveTempImage(buf, `q${box.number}_${Date.now()}.png`);
      crops.push({
        questionNumber: box.number,
        buffer: buf,
        imagePath: filePath,
      });
    } catch (error) {
      console.error(`Soru ${box.number} kesilirken hata:`, error.message);
      // Hata durumunda boş bir görüntü oluştur
      const fallbackWidth = box.wPercent ? Math.round((box.wPercent / 100) * imageWidth) : (box.w || 350);
      const fallbackHeight = box.hPercent ? Math.round((box.hPercent / 100) * imageHeight) : (box.h || 120);
      const emptyBuf = await sharp({
        create: {
          width: Math.max(1, fallbackWidth),
          height: Math.max(1, fallbackHeight),
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      }).png().toBuffer();
      const filePath = saveTempImage(emptyBuf, `q${box.number}_${Date.now()}.png`);
      crops.push({
        questionNumber: box.number,
        buffer: emptyBuf,
        imagePath: filePath,
      });
    }
  }
  return crops;
};

// Yardımcı: Dosya adından veya OCR'den öğrenci no çıkar
const extractStudentNumberFromFile = async (fileName, pngBuffer) => {
  const regex = /\b(20\d{4,6}|\d{7,12})\b/;
  const nameMatch = fileName ? fileName.match(regex) : null;
  if (nameMatch) return nameMatch[0];
  // Fallback: Gemini OCR
  const ocrId = await extractStudentIdFromImage(pngBuffer);
  return ocrId || null;
};

// Batch durum takibi (hafıza içi)
const batchStatuses = new Map();

// Create a new Exam (MÜDEK uyumlu)
const createExam = async (req, res) => {
  try {
    const {
      courseId,
      examType,
      examCode,
      questionCount,
      maxScorePerQuestion,
      questions,
    } = req.body;

    if (!courseId || !examType || !examCode || !questionCount || !maxScorePerQuestion) {
      return res.status(400).json({
        success: false,
        message: "courseId, examType, examCode, questionCount, maxScorePerQuestion zorunludur",
      });
    }

    if (Number(questionCount) <= 0 || Number(maxScorePerQuestion) <= 0) {
      return res.status(400).json({
        success: false,
        message: "questionCount ve maxScorePerQuestion pozitif olmalıdır",
      });
    }

    if (!["midterm", "final"].includes(examType)) {
      return res.status(400).json({
        success: false,
        message: "examType midterm veya final olmalıdır",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Ders bulunamadı" });
    }

    // Check if examCode already exists for this course
    const normalizedExamCode = examCode.trim();
    const existingExam = await Exam.findOne({
      courseId: courseId,
      examCode: normalizedExamCode,
    });
    if (existingExam) {
      return res.status(400).json({
        success: false,
        message: `"${normalizedExamCode}" sınav kodu bu ders için zaten mevcut. Aynı ders içinde aynı sınav kodu kullanılamaz.`,
      });
    }

    if (!Array.isArray(course.learningOutcomes) || course.learningOutcomes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Bu derste tanımlı öğrenme çıktısı (ÖÇ) yok",
      });
    }

    if (!Array.isArray(questions) || questions.length !== Number(questionCount)) {
      return res.status(400).json({
        success: false,
        message: "questions dizisi questionCount ile aynı uzunlukta olmalıdır",
      });
    }

    const loCodes = course.learningOutcomes.map((lo) => lo.code);
    const normalizedQuestions = questions.map((q, idx) => {
      const qNum = q?.questionNumber ?? idx + 1;
      if (!q.learningOutcomeCode) {
        throw new Error(`Soru ${qNum}: learningOutcomeCode gereklidir`);
      }
      if (!loCodes.includes(q.learningOutcomeCode)) {
        throw new Error(`Soru ${qNum}: learningOutcomeCode geçersiz (${q.learningOutcomeCode})`);
      }
      return {
        questionNumber: qNum,
        learningOutcomeCode: q.learningOutcomeCode,
      };
    });

    const exam = new Exam({
      courseId,
      examType,
      examCode: examCode.trim(),
      questionCount: Number(questionCount),
      maxScorePerQuestion: Number(maxScorePerQuestion),
      questions: normalizedQuestions,
    });

    const savedExam = await exam.save();

    // Update course's embedded exam information
    if (examType === "midterm") {
      course.midtermExam = {
        examCode: examCode.trim(),
        questionCount: Number(questionCount),
        maxScorePerQuestion: Number(maxScorePerQuestion),
      };
    } else if (examType === "final") {
      course.finalExam = {
        examCode: examCode.trim(),
        questionCount: Number(questionCount),
        maxScorePerQuestion: Number(maxScorePerQuestion),
      };
    }
    await course.save();

    return res.status(201).json({
      success: true,
      data: savedExam,
      derivedProgramOutcomes: derivePCFromExam(savedExam, course),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all Exams for a specific course
const getExamsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Validate courseId
    if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '[object Object]') {
      return res.status(400).json({ 
        success: false, 
        message: `Geçersiz ders ID: ${courseId}` 
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Ders bulunamadı" });
    }

    const exams = await Exam.find({ courseId }).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      data: exams,
    });
  } catch (error) {
    console.error('Error in getExamsByCourse:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Sınav bilgileri alınamadı",
    });
  }
};

// Get a single Exam by ID
const getExamById = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id).populate({
      path: "courseId",
      select: "name code learningOutcomes",
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: "Sınav bulunamadı" });
    }

    return res.status(200).json({
      success: true,
      data: exam,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update an Exam
const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      examType,
      examCode,
      questionCount,
      maxScorePerQuestion,
      questions,
    } = req.body;

    const existingExam = await Exam.findById(id);
    if (!existingExam) {
      return res.status(404).json({ success: false, message: "Sınav bulunamadı" });
    }

    const course = await Course.findById(existingExam.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Ders bulunamadı" });
    }

    // Check if examCode already exists for this course (excluding current exam)
    if (examCode !== undefined) {
      const normalizedExamCode = examCode.trim();
      const duplicateExam = await Exam.findOne({
        courseId: existingExam.courseId,
        examCode: normalizedExamCode,
        _id: { $ne: id }, // Exclude current exam
      });
      if (duplicateExam) {
        return res.status(400).json({
          success: false,
          message: `"${normalizedExamCode}" sınav kodu bu ders için zaten mevcut. Aynı ders içinde aynı sınav kodu kullanılamaz.`,
        });
      }
    }

    if (examType && !["midterm", "final"].includes(examType)) {
      return res.status(400).json({
        success: false,
        message: "examType midterm veya final olmalıdır",
      });
    }

    const loCodes = course.learningOutcomes?.map((lo) => lo.code) || [];
    let normalizedQuestions;
    if (questions !== undefined) {
      if (!Array.isArray(questions)) {
        return res.status(400).json({
          success: false,
          message: "questions dizisi geçersiz",
        });
      }
      normalizedQuestions = questions.map((q, idx) => {
        const qNum = q?.questionNumber ?? idx + 1;
        if (!q.learningOutcomeCode) {
          throw new Error(`Soru ${qNum}: learningOutcomeCode gereklidir`);
        }
        if (!loCodes.includes(q.learningOutcomeCode)) {
          throw new Error(`Soru ${qNum}: learningOutcomeCode geçersiz (${q.learningOutcomeCode})`);
        }
        return {
          questionNumber: qNum,
          learningOutcomeCode: q.learningOutcomeCode,
        };
      });
    }

    const updateData = {};
    if (examType !== undefined) updateData.examType = examType;
    if (examCode !== undefined) updateData.examCode = examCode.trim();
    if (questionCount !== undefined) updateData.questionCount = Number(questionCount);
    if (maxScorePerQuestion !== undefined) updateData.maxScorePerQuestion = Number(maxScorePerQuestion);
    if (normalizedQuestions !== undefined) updateData.questions = normalizedQuestions;

    const updatedExam = await Exam.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    // Update course's embedded exam information
    const currentExamType = examType || existingExam.examType;
    if (currentExamType === "midterm") {
      course.midtermExam = {
        examCode: (examCode !== undefined ? examCode.trim() : existingExam.examCode),
        questionCount: (questionCount !== undefined ? Number(questionCount) : existingExam.questionCount),
        maxScorePerQuestion: (maxScorePerQuestion !== undefined ? Number(maxScorePerQuestion) : existingExam.maxScorePerQuestion),
      };
    } else if (currentExamType === "final") {
      course.finalExam = {
        examCode: (examCode !== undefined ? examCode.trim() : existingExam.examCode),
        questionCount: (questionCount !== undefined ? Number(questionCount) : existingExam.questionCount),
        maxScorePerQuestion: (maxScorePerQuestion !== undefined ? Number(maxScorePerQuestion) : existingExam.maxScorePerQuestion),
      };
    }
    await course.save();

    return res.status(200).json({
      success: true,
      data: updatedExam,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete an Exam
const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Sınav bulunamadı" });
    }

    const hasScores = await Score.exists({ examId: id });
    if (hasScores) {
      return res.status(400).json({
        success: false,
        message: "Bu sınava ait skorlar var, silinemez.",
      });
    }

    const deletedExam = await Exam.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      data: deletedExam,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Batch score endpoint
const startBatchScore = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Sınav bulunamadı" });
    }
    const course = await Course.findById(exam.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Ders bulunamadı" });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "PDF dosyası yüklenmedi" });
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    batchStatuses.set(batchId, {
      batchId,
      totalFiles: files.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: new Date(),
      statuses: [],
    });

    // Asenkron işleme (fire-and-forget)
    process.nextTick(async () => {
      const status = batchStatuses.get(batchId);
      const promises = files.map(async (file) => {
        try {
          // 1) PDF -> PNG
          const { buffer: pngBuffer } = await pdfToPng(file.buffer);

          // 2) Öğrenci no
          const studentNumber = await extractStudentNumberFromFile(file.originalname, pngBuffer);
          if (!studentNumber) {
            throw new Error("Öğrenci numarası tespit edilemedi");
          }

          // 3) Marker
          const markers = await detectMarkers(pngBuffer);

          // 4) Crop
          const questionCrops = await cropQuestionRegions(pngBuffer, markers);

          // 5) Gemini skor
          const scored = [];
          for (const crop of questionCrops) {
            try {
              const score = await extractNumberFromImage(crop.buffer);
              scored.push({ questionNumber: crop.questionNumber, score });
            } catch (err) {
              scored.push({ questionNumber: crop.questionNumber, score: 0, error: err.message });
            }
          }

          // 6) ÖÇ eşleştir
          const loMap = new Map(
            (exam.questions || []).map((q) => [Number(q.questionNumber), q.learningOutcomeCode])
          );
          const mergedScores = scored.map((item) => ({
            questionNumber: item.questionNumber,
            score: item.score,
            learningOutcomeCode: loMap.get(item.questionNumber) || null,
          }));

          // 7) Kaydet
          await StudentExamResult.create({
            studentNumber,
            examId,
            courseId: exam.courseId,
            questionScores: mergedScores,
            outcomePerformance: {},
            programOutcomePerformance: {},
          });

          status.successCount += 1;
          status.statuses.push({
            studentNumber,
            status: "success",
            message: markers?.success ? "markers" : "template",
          });
        } catch (error) {
          status.failedCount += 1;
          status.statuses.push({
            studentNumber: null,
            status: "failed",
            message: error.message || "İşlenemedi",
          });
        } finally {
          status.processedCount += 1;
          batchStatuses.set(batchId, status);
        }
      });

      await Promise.allSettled(promises);
    });

    return res.status(202).json({
      success: true,
      data: {
        batchId,
        totalFiles: files.length,
        startedAt: new Date(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Batch puanlama başlatılamadı",
    });
  }
};

// Batch durum
const getBatchStatus = async (req, res) => {
  const { batchId } = req.query;
  const status = batchStatuses.get(batchId);
  if (!status) {
    return res.status(404).json({ success: false, message: "Batch bulunamadı" });
  }
  return res.status(200).json({ success: true, data: status });
};

// Submit scores via AI pipeline (PDF -> PNG -> Marker -> Crop -> Gemini)
const submitExamScores = async (req, res) => {
  try {
    const { examId } = req.params;
    const { studentNumber, pdfBase64 } = req.body;

    if (!studentNumber) {
      return res.status(400).json({ success: false, message: "studentNumber zorunlu" });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Sınav bulunamadı" });
    }

    const course = await Course.findById(exam.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Ders bulunamadı" });
    }

    let pdfBuffer;
    if (req.file?.buffer) {
      pdfBuffer = req.file.buffer;
    } else if (pdfBase64) {
      pdfBuffer = Buffer.from(pdfBase64, "base64");
    } else {
      return res.status(400).json({
        success: false,
        message: "PDF dosyası gerekli (file upload veya pdfBase64).",
      });
    }

    // 1) PDF -> PNG
    const { buffer: pngBuffer, filePath: pngPath } = await pdfToPng(pdfBuffer);

    // 2) Marker detection (with fallback)
    const markers = await detectMarkers(pngBuffer);

    // 3) Crop question regions (warp if markers success, else template fallback)
    const questionCrops = await cropQuestionRegions(pngBuffer, markers);

    // 4) Gemini Vision: skor okuma
    const scored = [];
    for (const crop of questionCrops) {
      try {
        console.log(`🔍 Soru ${crop.questionNumber} için Gemini Vision API çağrılıyor...`);
        const score = await extractNumberFromImage(crop.buffer);
        console.log(`✅ Soru ${crop.questionNumber} puanı: ${score}`);
        scored.push({ questionNumber: crop.questionNumber, score });
      } catch (err) {
        console.error(`❌ Soru ${crop.questionNumber} okuma hatası:`, err.message);
        scored.push({ questionNumber: crop.questionNumber, score: 0, error: err.message });
      }
    }

    // 5) Sınav yapısı ile eşleştir (learningOutcomeCode)
    const loMap = new Map(
      (exam.questions || []).map((q) => [Number(q.questionNumber), q.learningOutcomeCode])
    );
    const mergedScores = scored.map((item) => ({
      questionNumber: item.questionNumber,
      score: item.score,
      learningOutcomeCode: loMap.get(item.questionNumber) || null,
    }));

    // 6) DB kaydet: StudentExamResult
    const resultDoc = await StudentExamResult.create({
      studentNumber,
      examId,
      courseId: exam.courseId,
      questionScores: mergedScores,
      outcomePerformance: {}, // sonraki adımda hesaplanacak
      programOutcomePerformance: {},
    });

    return res.status(201).json({
      success: true,
      data: {
        pngPath,
        markers,
        processingMode: markers?.success ? "marker_based" : "template_fallback",
        processingMessage: markers?.message || (markers?.success ? "Marker tabanlı işleme başarılı" : "Marker bulunamadı, şablon modunda kesildi"),
        crops: questionCrops.map((c) => ({
          questionNumber: c.questionNumber,
          imagePath: c.imagePath,
        })),
        scores: mergedScores,
        resultId: resultDoc._id,
      },
    });
  } catch (error) {
    console.error("submitExamScores error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Sınav puanları işlenemedi",
    });
  }
};

// Get all results for an exam
const getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const results = await StudentExamResult.find({ examId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Sınav sonuçları getirilemedi",
    });
  }
};

export {
  createExam,
  getExamsByCourse,
  getExamById,
  updateExam,
  deleteExam,
  derivePCFromExam,
  submitExamScores,
  getExamResults,
  startBatchScore,
  getBatchStatus,
};

