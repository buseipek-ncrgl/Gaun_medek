import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Exam from "../models/Exam.js";
import Course from "../models/Course.js";
import Score from "../models/Score.js";
import StudentExamResult from "../models/StudentExamResult.js";
import Batch from "../models/Batch.js";
import Question from "../models/Question.js";
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
import {
  calculateOutcomePerformance,
  calculateProgramOutcomePerformance,
} from "../utils/assessmentCalculator.js";

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
    console.log(`📁 Created temp directory: ${tempDir}`);
  }
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, buffer);
  const fileSize = (buffer.length / 1024).toFixed(2);
  console.log(`💾 Saved crop image: ${filePath} (${fileSize} KB)`);
  return filePath;
};

// Yardımcı: Soru bölgelerini kes (marker varsa warp ile, yoksa template fallback)
const cropQuestionRegions = async (pngBuffer, markers) => {
  // Marker başarıyla bulunmuşsa warp + questionScoreBoxes
  if (markers?.success) {
    try {
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
    } catch (warpError) {
      console.warn("⚠️ Warp failed, falling back to template coordinates:", warpError.message);
      // Fall through to template fallback below
    }
  }

  // Fallback: template koordinatları ile orijinal PNG üzerinden kes
  // Template'te koordinatlar yüzde olarak saklanıyor, piksel değerlerine çevir
  const imageMetadata = await sharp(pngBuffer).metadata();
  const imageWidth = imageMetadata.width || template.templateSize.width;
  const imageHeight = imageMetadata.height || template.templateSize.height;
  
  console.log(`📐 Image dimensions: ${imageWidth}x${imageHeight}`);
  console.log(`📋 Using template fallback (OpenCV not available or markers not found)`);
  
  const fallbackBoxes = template.questionScoreBoxes || [];
  
  if (fallbackBoxes.length === 0) {
    throw new Error("Template'te soru koordinatları bulunamadı.");
  }
  
  const crops = [];
  
  for (const box of fallbackBoxes) {
    // Yüzde değerlerini piksel değerlerine çevir
    const x = box.x !== undefined ? box.x : Math.round((box.xPercent || 0) * imageWidth / 100);
    const y = box.y !== undefined ? box.y : Math.round((box.yPercent || 0) * imageHeight / 100);
    const w = box.w !== undefined ? box.w : Math.round((box.wPercent || 0) * imageWidth / 100);
    const h = box.h !== undefined ? box.h : Math.round((box.hPercent || 0) * imageHeight / 100);
    
    // Koordinatları doğrula
    if (x === undefined || y === undefined || w === undefined || h === undefined || 
        isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) || x < 0 || y < 0 || w <= 0 || h <= 0) {
      console.error(`⚠️ Invalid coordinates for question ${box.number}:`, { x, y, w, h, box });
      continue; // Bu soruyu atla
    }
    
    // Koordinatların görüntü sınırları içinde olduğunu kontrol et
    if (x + w > imageWidth || y + h > imageHeight) {
      console.warn(`⚠️ Question ${box.number} coordinates exceed image bounds. Adjusting...`);
      // Sınırları ayarla
      const adjustedW = Math.min(w, imageWidth - x);
      const adjustedH = Math.min(h, imageHeight - y);
      if (adjustedW <= 0 || adjustedH <= 0) {
        console.error(`❌ Question ${box.number} cannot be cropped (out of bounds)`);
        continue;
      }
      
      try {
        const buf = await sharp(pngBuffer)
          .extract({ left: x, top: y, width: adjustedW, height: adjustedH })
          .png()
          .toBuffer();
        const filePath = saveTempImage(buf, `q${box.number}_${Date.now()}.png`);
        crops.push({
          questionNumber: box.number,
          buffer: buf,
          imagePath: filePath,
        });
        continue;
      } catch (error) {
        console.error(`❌ Failed to crop question ${box.number} (adjusted):`, error.message);
        continue;
      }
    }
    
    try {
      const buf = await sharp(pngBuffer)
        .extract({ left: x, top: y, width: w, height: h })
        .png()
        .toBuffer();
      const filePath = saveTempImage(buf, `q${box.number}_${Date.now()}.png`);
      crops.push({
        questionNumber: box.number,
        buffer: buf,
        imagePath: filePath,
      });
      console.log(`✅ Cropped question ${box.number}: x=${x}, y=${y}, w=${w}, h=${h}`);
    } catch (error) {
      console.error(`❌ Failed to crop question ${box.number}:`, error.message);
      console.error(`   Coordinates: x=${x}, y=${y}, w=${w}, h=${h}`);
      console.error(`   Image size: ${imageWidth}x${imageHeight}`);
      // Devam et, diğer soruları işle
    }
  }
  
  if (crops.length === 0) {
    throw new Error("Hiçbir soru bölgesi kesilemedi. Template koordinatlarını ve görüntü boyutlarını kontrol edin.");
  }
  
  console.log(`✅ Successfully cropped ${crops.length}/${fallbackBoxes.length} questions`);
  return crops;
};

// Yardımcı: Dosya adından veya template koordinatlarından öğrenci no çıkar
const extractStudentNumberFromFile = async (fileName, pngBuffer) => {
  console.log(`🔍 Extracting student number from file: ${fileName || 'unknown'}`);
  
  // 1) Önce dosya adından dene
  const regex = /\b(20\d{4,6}|\d{7,12})\b/;
  const nameMatch = fileName ? fileName.match(regex) : null;
  if (nameMatch) {
    console.log(`✅ Student number from filename: ${nameMatch[0]}`);
    return nameMatch[0];
  }
  
  console.log(`⚠️ Student number not found in filename: "${fileName}"`);
  
  // 2) Template koordinatlarından öğrenci numarası kutularını kes ve oku
  try {
    const studentNumberBoxes = template.studentNumberBoxes || [];
    if (studentNumberBoxes.length > 0) {
      const imageMetadata = await sharp(pngBuffer).metadata();
      const imageWidth = imageMetadata.width || template.templateSize.width;
      const imageHeight = imageMetadata.height || template.templateSize.height;
      
      const digitBoxes = [];
      for (const box of studentNumberBoxes) {
        // Yüzde değerlerini piksel değerlerine çevir
        const x = box.x !== undefined ? box.x : Math.round((box.xPercent || 0) * imageWidth / 100);
        const y = box.y !== undefined ? box.y : Math.round((box.yPercent || 0) * imageHeight / 100);
        const w = box.w !== undefined ? box.w : Math.round((box.wPercent || 0) * imageWidth / 100);
        const h = box.h !== undefined ? box.h : Math.round((box.hPercent || 0) * imageHeight / 100);
        
        if (x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= imageWidth && y + h <= imageHeight) {
          try {
            const digitBuffer = await sharp(pngBuffer)
              .extract({ left: x, top: y, width: w, height: h })
              .png()
              .toBuffer();
            digitBoxes.push(digitBuffer);
          } catch (error) {
            console.warn(`⚠️ Failed to crop student number digit ${box.digit}:`, error.message);
          }
        }
      }
      
      // Template'te 9 hane var (bazı sınavlarda 9, bazılarında 10 olabilir)
      const expectedDigits = studentNumberBoxes.length;
      if (digitBoxes.length === expectedDigits) {
        // extractStudentNumber fonksiyonunu import et
        const { extractStudentNumber } = await import("../utils/geminiVision.js");
        const studentNumber = await extractStudentNumber(digitBoxes);
        if (studentNumber && studentNumber.length >= 7) {
          console.log(`✅ Student number from template coordinates (${expectedDigits} digits): ${studentNumber}`);
          return studentNumber;
        }
      } else {
        console.warn(`⚠️ Could not crop all ${expectedDigits} student number digits (got ${digitBoxes.length})`);
      }
    }
  } catch (error) {
    console.warn("⚠️ Template-based student number extraction failed:", error.message);
  }
  
  // 3) Son fallback: Tüm sayfadan Gemini OCR
  console.log("🔄 Trying full-page OCR for student number...");
  const ocrId = await extractStudentIdFromImage(pngBuffer);
  if (ocrId) {
    console.log(`✅ Student number from full-page OCR: ${ocrId}`);
    return ocrId;
  }
  
  console.error(`❌ Student number could not be extracted from file: "${fileName}"`);
  console.error(`   Tried: filename regex, template coordinates (${studentNumberBoxes.length} digits), full-page OCR`);
  return null;
};

// Batch durum takibi - MongoDB'de saklanıyor (RAM'de değil)
// Eski Map kodu kaldırıldı - artık MongoDB kullanıyoruz

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
    
    // MongoDB'ye batch kaydı oluştur
    const batch = await Batch.create({
      batchId,
      examId,
      courseId: exam.courseId,
      totalFiles: files.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: new Date(),
      statuses: [],
      isComplete: false,
    });

    // Asenkron işleme (fire-and-forget)
    // Course'u closure'da kullanmak için burada tanımlıyoruz
    const courseForProcessing = course;
    process.nextTick(async () => {
      const promises = files.map(async (file) => {
        try {
          // 1) PDF -> PNG
          const { buffer: pngBuffer } = await pdfToPng(file.buffer);

          // 2) Öğrenci no
          console.log(`\n📄 Processing file: ${file.originalname}`);
          const studentNumber = await extractStudentNumberFromFile(file.originalname, pngBuffer);
          if (!studentNumber) {
            console.error(`❌ [${file.originalname}] Student number extraction failed`);
            throw new Error(`Öğrenci numarası tespit edilemedi: ${file.originalname}`);
          }
          console.log(`✅ [${file.originalname}] Student number: ${studentNumber}`);

          // 3) Marker
          const markers = await detectMarkers(pngBuffer);
          console.log(`📸 [Batch ${studentNumber}] Markers success: ${markers?.success || false}`);

          // 4) Crop
          const questionCrops = await cropQuestionRegions(pngBuffer, markers);
          console.log(`✅ [Batch ${studentNumber}] Cropped ${questionCrops.length} question regions`);
          
          // Log crop details
          questionCrops.forEach((crop) => {
            console.log(`  - Question ${crop.questionNumber}: ${crop.imagePath || 'no path'}`);
          });

          // 5) Gemini skor
          console.log(`\n📊 [Batch ${studentNumber}] Starting Gemini score extraction for ${questionCrops.length} questions...`);
          const scored = [];
          for (const crop of questionCrops) {
            try {
              console.log(`\n🔍 [Batch ${studentNumber} - Q${crop.questionNumber}] Calling Gemini API...`);
              console.log(`   Image path: ${crop.imagePath || 'in-memory'}`);
              const score = await extractNumberFromImage(crop.buffer);
              console.log(`   ✅ [Batch ${studentNumber} - Q${crop.questionNumber}] Final score: ${score}`);
              scored.push({ questionNumber: crop.questionNumber, score });
            } catch (err) {
              console.error(`   ❌ [Batch ${studentNumber} - Q${crop.questionNumber}] Score extraction failed:`, err.message);
              scored.push({ questionNumber: crop.questionNumber, score: 0, error: err.message });
            }
          }
          
          console.log(`\n📊 [Batch ${studentNumber}] Score Summary:`);
          console.log(`   Total questions: ${scored.length}`);
          console.log(`   Non-zero scores: ${scored.filter(s => s.score > 0).length}`);
          console.log(`   Zero scores: ${scored.filter(s => s.score === 0).length}`);
          scored.forEach((s) => {
            console.log(`   Q${s.questionNumber}: ${s.score}${s.error ? ` (error: ${s.error})` : ''}`);
          });

          // 6) ÖÇ eşleştir
          const loMap = new Map(
            (exam.questions || []).map((q) => [Number(q.questionNumber), q.learningOutcomeCode])
          );
          console.log(`📊 [Batch ${studentNumber}] ÖÇ eşleştirme haritası:`, Array.from(loMap.entries()));
          const mergedScores = scored.map((item) => {
            const loCode = loMap.get(item.questionNumber) || loMap.get(Number(item.questionNumber)) || null;
            if (!loCode) {
              console.warn(`⚠️ [Batch ${studentNumber}] Soru ${item.questionNumber} için ÖÇ kodu bulunamadı!`);
            }
            return {
              questionNumber: item.questionNumber,
              score: item.score,
              learningOutcomeCode: loCode,
            };
          });
          console.log(`📊 [Batch ${studentNumber}] Merged scores (ilk 3):`, mergedScores.slice(0, 3).map(s => `Q${s.questionNumber}:${s.score} (ÖÇ:${s.learningOutcomeCode || 'YOK'})`));

          // 7) ÖÇ ve PÇ performansını hesapla
          let outcomePerformance = {};
          let programOutcomePerformance = {};
          
          if (courseForProcessing && courseForProcessing.learningOutcomes && courseForProcessing.learningOutcomes.length > 0) {
            // Tek öğrenci için soru analizi oluştur
            const questionAnalysis = mergedScores.map((qs) => {
              const maxScore = exam.maxScorePerQuestion || 0;
              const success = maxScore > 0 ? (qs.score / maxScore) * 100 : 0;
              return {
                questionNumber: qs.questionNumber,
                maxScore,
                averageScore: qs.score,
                successRate: success,
                learningOutcomeCode: qs.learningOutcomeCode,
                attempts: 1,
              };
            });
            
            // ÖÇ performansını hesapla
            const loPerformance = calculateOutcomePerformance(questionAnalysis, exam, courseForProcessing);
            outcomePerformance = Object.fromEntries(
              loPerformance.map((lo) => [lo.code, lo.success])
            );
            
            // PÇ performansını hesapla
            const poPerformance = calculateProgramOutcomePerformance(loPerformance, courseForProcessing);
            programOutcomePerformance = Object.fromEntries(
              poPerformance.map((po) => [po.code, po.success])
            );
          }

          // 8) Kaydet veya Güncelle (upsert)
          // Aynı öğrenci aynı sınavda birden fazla kayıt olmasın - son sonuç geçerli
          await StudentExamResult.findOneAndUpdate(
            {
              studentNumber,
              examId,
            },
            {
              studentNumber,
              examId,
              courseId: exam.courseId,
              questionScores: mergedScores,
              outcomePerformance,
              programOutcomePerformance,
            },
            {
              upsert: true, // Yoksa oluştur, varsa güncelle
              new: true, // Yeni kaydı döndür
              setDefaultsOnInsert: true,
            }
          );
          
          console.log(`✅ Student result saved/updated: ${studentNumber} - Exam: ${examId}`);

          // MongoDB'de batch'i güncelle (atomic update)
          await Batch.findOneAndUpdate(
            { batchId },
            {
              $inc: { 
                processedCount: 1,
                successCount: 1 
              },
              $push: {
                statuses: {
                  studentNumber,
                  status: "success",
                  message: markers?.success ? "markers" : "template",
                }
              }
            },
            { new: true }
          );
        } catch (error) {
          // MongoDB'de batch'i güncelle (hata durumu)
          await Batch.findOneAndUpdate(
            { batchId },
            {
              $inc: { 
                processedCount: 1,
                failedCount: 1 
              },
              $push: {
                statuses: {
                  studentNumber: null,
                  status: "failed",
                  message: error.message || "İşlenemedi",
                }
              }
            },
            { new: true }
          );
        }
      });

      // Tüm dosyalar işlendikten sonra batch'i tamamla olarak işaretle
      await Promise.allSettled(promises);
      
      // Batch tamamlandı mı kontrol et ve güncelle
      const finalBatch = await Batch.findOne({ batchId });
      if (finalBatch && finalBatch.processedCount >= finalBatch.totalFiles) {
        await Batch.findOneAndUpdate(
          { batchId },
          {
            isComplete: true,
            completedAt: new Date(),
          }
        );
      }
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
  try {
    // Set CORS headers explicitly
    const origin = req.headers.origin;
    if (origin) {
      // Allow Vercel, Render, and localhost
      const isAllowed = 
        origin.includes('vercel.app') ||
        origin.includes('onrender.com') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.startsWith('https://gaun-mudek');
      
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      }
    }
    
    const { examId } = req.params;
    const { batchId } = req.query;
    
    // Validate examId
    if (!examId || examId === 'undefined' || examId === 'null') {
      return res.status(400).json({ 
        success: false, 
        message: "Geçersiz examId" 
      });
    }
    
    // Validate batchId
    if (!batchId) {
      return res.status(400).json({ 
        success: false, 
        message: "batchId query parameter is required" 
      });
    }
    
    // MongoDB'den batch durumunu al
    const batch = await Batch.findOne({ batchId, examId });
    if (!batch) {
      return res.status(404).json({ 
        success: false, 
        message: "Batch bulunamadı",
        batchId,
        hint: "Batch ID'yi kontrol edin veya yeni bir batch başlatın."
      });
    }
    
    // Return status
    return res.status(200).json({ 
      success: true, 
      data: {
        batchId: batch.batchId,
        totalFiles: batch.totalFiles,
        processedCount: batch.processedCount,
        successCount: batch.successCount,
        failedCount: batch.failedCount,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
        statuses: batch.statuses || [],
        isComplete: batch.isComplete || batch.processedCount >= batch.totalFiles
      }
    });
  } catch (error) {
    console.error(`[getBatchStatus] Unexpected error:`, error);
    
    // Set CORS headers even on error
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed = 
        origin.includes('vercel.app') ||
        origin.includes('onrender.com') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.startsWith('https://gaun-mudek');
      
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }
    
    // Ensure we always send a response, even on error
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Batch status alınamadı",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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
    console.log(`📸 Starting crop process... Markers success: ${markers?.success || false}`);
    const questionCrops = await cropQuestionRegions(pngBuffer, markers);
    console.log(`✅ Cropped ${questionCrops.length} question regions`);
    
    // Log crop details
    questionCrops.forEach((crop) => {
      console.log(`  - Question ${crop.questionNumber}: ${crop.imagePath || 'no path'}`);
    });

    // 4) Gemini Vision: skor okuma
    console.log(`\n📊 Starting Gemini score extraction for ${questionCrops.length} questions...`);
    const scored = [];
    for (const crop of questionCrops) {
      try {
        console.log(`\n🔍 [Question ${crop.questionNumber}] Calling Gemini API...`);
        console.log(`   Image path: ${crop.imagePath || 'in-memory'}`);
        const score = await extractNumberFromImage(crop.buffer);
        console.log(`   ✅ [Question ${crop.questionNumber}] Final score: ${score}`);
        scored.push({ questionNumber: crop.questionNumber, score });
      } catch (err) {
        console.error(`   ❌ [Question ${crop.questionNumber}] Score extraction failed:`, err.message);
        scored.push({ questionNumber: crop.questionNumber, score: 0, error: err.message });
      }
    }
    
    console.log(`\n📊 Score Summary:`);
    console.log(`   Total questions: ${scored.length}`);
    console.log(`   Non-zero scores: ${scored.filter(s => s.score > 0).length}`);
    console.log(`   Zero scores: ${scored.filter(s => s.score === 0).length}`);
    scored.forEach((s) => {
      console.log(`   Q${s.questionNumber}: ${s.score}${s.error ? ` (error: ${s.error})` : ''}`);
    });

    // 5) Sınav yapısı ile eşleştir (learningOutcomeCode)
    const loMap = new Map(
      (exam.questions || []).map((q) => [Number(q.questionNumber), q.learningOutcomeCode])
    );
    console.log(`📊 ÖÇ eşleştirme haritası:`, Array.from(loMap.entries()));
    const mergedScores = scored.map((item) => {
      const loCode = loMap.get(item.questionNumber) || loMap.get(Number(item.questionNumber)) || null;
      if (!loCode) {
        console.warn(`⚠️ Soru ${item.questionNumber} için ÖÇ kodu bulunamadı!`);
      }
      return {
        questionNumber: item.questionNumber,
        score: item.score,
        learningOutcomeCode: loCode,
      };
    });
    console.log(`📊 Merged scores (ilk 3):`, mergedScores.slice(0, 3).map(s => `Q${s.questionNumber}:${s.score} (ÖÇ:${s.learningOutcomeCode || 'YOK'})`));

    // Calculate total scores
    const totalScore = mergedScores.reduce((sum, s) => sum + (s.score || 0), 0);
    // Use exam.maxScorePerQuestion instead of Question model
    const maxTotalScore = (exam.questionCount || 0) * (exam.maxScorePerQuestion || 0);
    const percentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
    
    console.log(`📊 Total score: ${totalScore}/${maxTotalScore} (${percentage.toFixed(2)}%)`);
    console.log(`📋 Scores breakdown:`, mergedScores.map(s => `Q${s.questionNumber}:${s.score}`).join(', '));

    // 6) ÖÇ ve PÇ performansını hesapla
    let outcomePerformance = {};
    let programOutcomePerformance = {};
    
    if (course && course.learningOutcomes && course.learningOutcomes.length > 0) {
      // Tek öğrenci için soru analizi oluştur
      const questionAnalysis = mergedScores.map((qs) => {
        const maxScore = exam.maxScorePerQuestion || 0;
        const success = maxScore > 0 ? (qs.score / maxScore) * 100 : 0;
        return {
          questionNumber: qs.questionNumber,
          maxScore,
          averageScore: qs.score,
          successRate: success,
          learningOutcomeCode: qs.learningOutcomeCode,
          attempts: 1,
        };
      });
      
      // ÖÇ performansını hesapla
      const loPerformance = calculateOutcomePerformance(questionAnalysis, exam, course);
      outcomePerformance = Object.fromEntries(
        loPerformance.map((lo) => [lo.code, lo.success])
      );
      
      // PÇ performansını hesapla
      const poPerformance = calculateProgramOutcomePerformance(loPerformance, course);
      programOutcomePerformance = Object.fromEntries(
        poPerformance.map((po) => [po.code, po.success])
      );
    }

    // 7) DB kaydet veya güncelle: StudentExamResult (upsert)
    // Aynı öğrenci aynı sınavda birden fazla kayıt olmasın - son sonuç geçerli
    const resultDoc = await StudentExamResult.findOneAndUpdate(
      {
        studentNumber,
        examId,
      },
      {
        studentNumber,
        examId,
        courseId: exam.courseId,
        questionScores: mergedScores,
        outcomePerformance,
        programOutcomePerformance,
      },
      {
        upsert: true, // Yoksa oluştur, varsa güncelle
        new: true, // Yeni kaydı döndür
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json({
      success: true,
      data: {
        pngPath,
        markers,
        crops: questionCrops.map((c) => ({
          questionNumber: c.questionNumber,
          imagePath: c.imagePath,
        })),
        scores: mergedScores,
        resultId: resultDoc._id,
        totalScore,
        maxTotalScore,
        percentage: Math.round(percentage * 100) / 100,
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
    const results = await StudentExamResult.find({ examId })
      .populate("examId", "examCode examType")
      .populate("courseId", "code name")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Sınav sonuçları getirilemedi",
    });
  }
};

// Get all exam results for a student by studentNumber
const getExamResultsByStudent = async (req, res) => {
  try {
    const { studentNumber } = req.params;
    const results = await StudentExamResult.find({ studentNumber })
      .populate("examId", "examCode examType maxScorePerQuestion")
      .populate("courseId", "code name")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Öğrenci sınav sonuçları getirilemedi",
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
  getExamResultsByStudent,
  startBatchScore,
  getBatchStatus,
};

