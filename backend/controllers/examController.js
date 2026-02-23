import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Exam from "../models/Exam.js";
import Course from "../models/Course.js";
import Score from "../models/Score.js";
import StudentExamResult from "../models/StudentExamResult.js";
import Student from "../models/Student.js";
import Batch from "../models/Batch.js";
import Question from "../models/Question.js";
import { createNotification } from "./notificationController.js";
import { pdfToPng } from "../utils/pdfToPng.js";
import { detectMarkers } from "../utils/markerDetect.js";
import { warpAndDefineROIs, cropROI, cropTotalScoreBox } from "../utils/roiCrop.js";

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
import { getCourseFilterForUser } from "../middleware/authMiddleware.js";

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

// cropTotalScoreBox artık utils/roiCrop.js'de tanımlı

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
  
  // 2) Template koordinatlarından öğrenci numarası kutusunu kes ve oku (tek kutu veya çok kutu)
  try {
    const studentNumberBoxes = template.studentNumberBoxes || [];
    if (studentNumberBoxes.length > 0) {
      const imageMetadata = await sharp(pngBuffer).metadata();
      const imageWidth = imageMetadata.width || template.templateSize.width;
      const imageHeight = imageMetadata.height || template.templateSize.height;
      const box = studentNumberBoxes[0];

      // Tek kutuda tüm öğrenci numarası (digit === "all")
      const isSingleBox = box.digit === "all" || (template.studentNumberBox && template.studentNumberBox.singleBox);
      if (isSingleBox && studentNumberBoxes.length === 1) {
        const x = box.x !== undefined ? box.x : Math.round((box.xPercent || 0) * imageWidth / 100);
        const y = box.y !== undefined ? box.y : Math.round((box.yPercent || 0) * imageHeight / 100);
        const w = box.w !== undefined ? box.w : Math.round((box.wPercent || 0) * imageWidth / 100);
        const h = box.h !== undefined ? box.h : Math.round((box.hPercent || 0) * imageHeight / 100);
        if (x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= imageWidth && y + h <= imageHeight) {
          try {
            const singleBuffer = await sharp(pngBuffer)
              .extract({ left: x, top: y, width: w, height: h })
              .png()
              .toBuffer();
            const { extractStudentNumberFromSingleBox } = await import("../utils/geminiVision.js");
            const studentNumber = await extractStudentNumberFromSingleBox(singleBuffer);
            if (studentNumber && studentNumber.length >= 5) {
              console.log(`✅ Student number from single box (template): ${studentNumber}`);
              return studentNumber;
            }
          } catch (err) {
            console.warn("⚠️ Single-box student number extraction failed:", err.message);
          }
        }
        // Fall through to full-page OCR if single box failed
      } else {
        // Çok kutu (her hane ayrı)
        const digitBoxes = [];
        for (const b of studentNumberBoxes) {
          const x = b.x !== undefined ? b.x : Math.round((b.xPercent || 0) * imageWidth / 100);
          const y = b.y !== undefined ? b.y : Math.round((b.yPercent || 0) * imageHeight / 100);
          const w = b.w !== undefined ? b.w : Math.round((b.wPercent || 0) * imageWidth / 100);
          const h = b.h !== undefined ? b.h : Math.round((b.hPercent || 0) * imageHeight / 100);
          if (x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= imageWidth && y + h <= imageHeight) {
            try {
              const digitBuffer = await sharp(pngBuffer)
                .extract({ left: x, top: y, width: w, height: h })
                .png()
                .toBuffer();
              digitBoxes.push(digitBuffer);
            } catch (error) {
              console.warn(`⚠️ Failed to crop student number digit ${b.digit}:`, error.message);
            }
          }
        }
        const expectedDigits = studentNumberBoxes.length;
        if (digitBoxes.length === expectedDigits) {
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
  console.error(`   Tried: filename regex, template coordinates, full-page OCR`);
  return null;
};

// Batch durum takibi - MongoDB'de saklanıyor (RAM'de değil)
// Eski Map kodu kaldırıldı - artık MongoDB kullanıyoruz

// Create a new Exam (MEDEK uyumlu)
const createExam = async (req, res) => {
  try {
    const {
      courseId,
      examType,
      examCode,
      maxScore,
      learningOutcomes, // Sınav bazlı ÖÇ eşleme array'i
      questions, // Soru bazlı ÖÇ eşleme array'i
      passingScore, // Geçme notu (0-100, örn. 40); yoksa varsayılan 60
    } = req.body;

    if (!courseId || !examType || !examCode) {
      return res.status(400).json({
        success: false,
        message: "courseId, examType, examCode zorunludur",
      });
    }

    // maxScore her zaman 100 olarak kaydedilir
    const finalMaxScore = 100;

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

    // ÖÇ eşleme validasyonu
    let normalizedLOs = [];
    if (learningOutcomes && Array.isArray(learningOutcomes) && learningOutcomes.length > 0) {
      const loCodes = course.learningOutcomes.map((lo) => lo.code);
      normalizedLOs = learningOutcomes.filter((loCode) => loCodes.includes(loCode));
      
      if (normalizedLOs.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Seçilen ÖÇ kodları geçersiz veya bu ders için tanımlı değil",
        });
      }
    }

    // Get question count from course
    const questionCount = examType === "midterm" 
      ? course.midtermExam?.questionCount || 0
      : course.finalExam?.questionCount || 0;

    // Use questions from request if provided, otherwise create from learning outcomes
    let examQuestions = [];
    if (questions && Array.isArray(questions) && questions.length > 0) {
      // Use questions from frontend (question-based LO mapping)
      examQuestions = questions;
    } else if (questionCount > 0 && normalizedLOs && normalizedLOs.length > 0) {
      // Create questions array from learning outcomes (backward compatibility)
      for (let i = 1; i <= questionCount; i++) {
        examQuestions.push({
          questionNumber: i,
          learningOutcomeCode: normalizedLOs[(i - 1) % normalizedLOs.length] || "",
        });
      }
    } else if (questionCount > 0) {
      // Create empty questions if no LOs selected yet
      for (let i = 1; i <= questionCount; i++) {
        examQuestions.push({
          questionNumber: i,
          learningOutcomeCode: "",
        });
      }
    }

    const passingScoreNum = passingScore != null ? Math.min(100, Math.max(0, Number(passingScore))) : 60;
    const exam = new Exam({
      courseId,
      examType,
      examCode: examCode.trim(),
      maxScore: 100, // Her zaman 100
      learningOutcomes: normalizedLOs, // Sınav bazlı ÖÇ eşleme
      questionCount: questionCount,
      questions: examQuestions,
      passingScore: passingScoreNum,
    });

    const savedExam = await exam.save();

    // Update course's embedded exam information
    if (examType === "midterm") {
      course.midtermExam = {
        examCode: examCode.trim(),
        maxScore: 100, // Her zaman 100
      };
    } else if (examType === "final") {
      course.finalExam = {
        examCode: examCode.trim(),
        maxScore: 100, // Her zaman 100
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

// Get all Exams (from all courses; rol varsa sadece yetkili derslerin sınavları)
const getAllExams = async (req, res) => {
  try {
    const courseFilter = getCourseFilterForUser(req.user || null);
    const allowedCourseIds = await Course.find(courseFilter).distinct("_id");
    const exams = await Exam.find({ courseId: { $in: allowedCourseIds } })
      .populate({
        path: "courseId",
        select: "name code",
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      data: exams,
    });
  } catch (error) {
    console.error('Error in getAllExams:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Sınavlar getirilirken bir hata oluştu",
    });
  }
};

// Get all Exams for a specific course (rol varsa derse erişim yetkisi kontrolü)
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

    if (req.user) {
      const courseFilter = getCourseFilterForUser(req.user);
      const allowed = await Course.findOne({ ...courseFilter, _id: courseId }).select("_id").lean();
      if (!allowed) {
        return res.status(403).json({ success: false, message: "Bu derse erişim yetkiniz yok." });
      }
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

    const exam = await Exam.findById(id)
      .populate({
        path: "courseId",
        select: "name code learningOutcomes",
      })
      .lean();

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
      maxScore,
      learningOutcomes, // Sınav bazlı ÖÇ eşleme array'i
      questions, // Soru bazlı ÖÇ eşleme array'i
      passingScore, // Geçme notu (0-100)
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

    // ÖÇ eşleme validasyonu
    let normalizedLOs;
    if (learningOutcomes !== undefined) {
      if (!Array.isArray(learningOutcomes)) {
        return res.status(400).json({
          success: false,
          message: "learningOutcomes bir array olmalıdır",
        });
      }
      
      const loCodes = course.learningOutcomes?.map((lo) => lo.code) || [];
      normalizedLOs = learningOutcomes.filter((loCode) => loCodes.includes(loCode));
      
      if (learningOutcomes.length > 0 && normalizedLOs.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Seçilen ÖÇ kodları geçersiz veya bu ders için tanımlı değil",
        });
      }
    }

    // Get question count from course, or from questions if provided, or from existing exam
    let questionCount = (examType || existingExam.examType) === "midterm" 
      ? course.midtermExam?.questionCount || 0
      : course.finalExam?.questionCount || 0;
    
    // If questions are provided, use their length as questionCount (fallback)
    if (questions !== undefined && Array.isArray(questions) && questions.length > 0) {
      // Use questions length if course questionCount is 0 or missing
      if (questionCount === 0) {
        questionCount = questions.length;
        console.log(`📊 Using questionCount from questions array: ${questionCount}`);
      }
    } else if (questionCount === 0 && existingExam.questions && Array.isArray(existingExam.questions) && existingExam.questions.length > 0) {
      // Fallback to existing exam's question count
      questionCount = existingExam.questions.length;
      console.log(`📊 Using questionCount from existing exam: ${questionCount}`);
    }

    // Use questions from request if provided, otherwise keep existing or create from learning outcomes
    let examQuestions = [];
    if (questions !== undefined) {
      // Questions explicitly provided in request
      if (Array.isArray(questions) && questions.length > 0) {
        // Use questions from frontend (question-based LO mapping)
        examQuestions = questions;
      } else if (questionCount > 0) {
        // Empty array provided, create empty questions
        for (let i = 1; i <= questionCount; i++) {
          examQuestions.push({
            questionNumber: i,
            learningOutcomeCode: "",
          });
        }
      }
    } else if (normalizedLOs !== undefined && questionCount > 0) {
      // No questions in request, but learningOutcomes provided - create from LOs
      if (normalizedLOs && normalizedLOs.length > 0) {
        for (let i = 1; i <= questionCount; i++) {
          examQuestions.push({
            questionNumber: i,
            learningOutcomeCode: normalizedLOs[(i - 1) % normalizedLOs.length] || "",
          });
        }
      } else if (questionCount > 0) {
        // Create empty questions if no LOs selected
        for (let i = 1; i <= questionCount; i++) {
          examQuestions.push({
            questionNumber: i,
            learningOutcomeCode: "",
          });
        }
      }
    } else if (questions === undefined && normalizedLOs === undefined && existingExam.questions && Array.isArray(existingExam.questions) && existingExam.questions.length > 0) {
      // If questions is undefined and no normalizedLOs, keep existing questions (don't update)
      examQuestions = existingExam.questions;
      console.log(`📊 Keeping existing questions from exam: ${examQuestions.length}`);
    }

    const updateData = {};
    if (examType !== undefined) updateData.examType = examType;
    if (examCode !== undefined) updateData.examCode = examCode.trim();
    updateData.maxScore = 100; // Her zaman 100
    if (normalizedLOs !== undefined) updateData.learningOutcomes = normalizedLOs;
    updateData.questionCount = questionCount;
    if (passingScore !== undefined) {
      updateData.passingScore = Math.min(100, Math.max(0, Number(passingScore)));
    }
    // Only update questions if explicitly provided or if we created new ones
    if (questions !== undefined || examQuestions.length > 0) {
      updateData.questions = examQuestions;
    }

    const updatedExam = await Exam.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    // Update course's embedded exam information
    const currentExamType = examType || existingExam.examType;
    if (currentExamType === "midterm") {
      course.midtermExam = {
        examCode: (examCode !== undefined ? examCode.trim() : existingExam.examCode),
        maxScore: 100, // Her zaman 100
      };
    } else if (currentExamType === "final") {
      course.finalExam = {
        examCode: (examCode !== undefined ? examCode.trim() : existingExam.examCode),
        maxScore: 100, // Her zaman 100
      };
    }
    await course.save();

    // Populate courseId before returning (lean: tüm alanlar dahil passingScore)
    const populatedExam = await Exam.findById(updatedExam._id)
      .populate({
        path: "courseId",
        select: "name code learningOutcomes",
      })
      .lean()
      .exec();

    return res.status(200).json({
      success: true,
      data: populatedExam || updatedExam,
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

          // 3) Marker (OpenCV disabled on Render - will use fallback)
          let markers = { success: false, reason: "opencv_disabled" };
          try {
            markers = await detectMarkers(pngBuffer);
            console.log(`📸 [Batch ${studentNumber}] Markers success: ${markers?.success || false}`);
          } catch (markerError) {
            console.warn(`⚠️ [Batch ${studentNumber}] Marker detection failed (using fallback):`, markerError.message);
            // Continue with fallback template coordinates
          }

          // 4) Crop genel puan kutusu (will use template fallback if OpenCV disabled)
          const totalScoreCrop = await cropTotalScoreBox(pngBuffer, markers);
          console.log(`✅ [Batch ${studentNumber}] Cropped total score box: ${totalScoreCrop.imagePath || 'no path'}`);

          // 5) Gemini genel puan okuma (tek kutu veya 20 kutu toplamı)
          console.log(`\n📊 [Batch ${studentNumber}] Starting Gemini total score extraction...`);
          let totalScore = 0;
          try {
            if (totalScoreCrop.buffers && totalScoreCrop.buffers.length === 20) {
              const { extractScores } = await import("../utils/geminiVision.js");
              const scores = await extractScores(totalScoreCrop.buffers);
              totalScore = scores.reduce((a, b) => a + b, 0);
              console.log(`   ✅ [Batch ${studentNumber}] Total score (20 boxes sum): ${totalScore}`);
            } else {
              console.log(`   Image path: ${totalScoreCrop.imagePath || 'in-memory'}`);
              totalScore = await extractNumberFromImage(totalScoreCrop.buffer, "total score");
              console.log(`   ✅ [Batch ${studentNumber}] Total score extracted: ${totalScore}`);
            }
          } catch (err) {
            console.error(`   ❌ [Batch ${studentNumber}] Total score extraction failed:`, err.message);
            throw new Error(`Genel puan okunamadı: ${err.message}`);
          }
          
          // Calculate max score and percentage
          const maxTotalScore = exam.maxScore || 0;
          const percentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
          
          console.log(`📊 [Batch ${studentNumber}] Total score: ${totalScore}/${maxTotalScore} (${percentage.toFixed(2)}%)`);

          // 6) ÖÇ ve PÇ performansını hesapla (genel puan bazlı)
          // Sadece sınavda eşlenen ÖÇ'ler için hesaplama yap
          let outcomePerformance = {};
          let programOutcomePerformance = {};
          
          if (courseForProcessing && courseForProcessing.learningOutcomes && courseForProcessing.learningOutcomes.length > 0) {
            // Sınavın questions array'inden eşlenen ÖÇ kodlarını al
            const examQuestions = exam.questions || [];
            const mappedLOCodes = new Set();
            examQuestions.forEach((q) => {
              if (q.learningOutcomeCode && q.learningOutcomeCode.trim() !== "") {
                mappedLOCodes.add(q.learningOutcomeCode);
              }
            });
            
            // Eğer sınavda ÖÇ eşlemesi varsa sadece onları kullan, yoksa tüm ÖÇ'leri kullan
            const relevantLOs = mappedLOCodes.size > 0
              ? courseForProcessing.learningOutcomes.filter((lo) => mappedLOCodes.has(lo.code))
              : courseForProcessing.learningOutcomes;
            
            // Her eşlenen ÖÇ için genel puan yüzdesini uygula
            const loPerformance = relevantLOs.map((lo) => ({
              code: lo.code,
              description: lo.description,
              success: percentage, // Genel puan yüzdesi = ÖÇ başarısı
            }));
            
            outcomePerformance = Object.fromEntries(
              loPerformance.map((lo) => [lo.code, lo.success])
            );
            
            // PÇ performansını hesapla (ÖÇ'lerden)
            const poPerformance = calculateProgramOutcomePerformance(loPerformance, courseForProcessing);
            programOutcomePerformance = Object.fromEntries(
              poPerformance.map((po) => [po.code, po.success])
            );
          }

          // 7) Kaydet veya Güncelle (upsert)
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
              totalScore,
              maxScore: maxTotalScore,
              percentage: Math.round(percentage * 100) / 100,
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
          const updateResult = await Batch.findOneAndUpdate(
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
          console.error(`❌ [Batch] Error processing file ${file?.originalname || 'unknown'}:`, error.message);
          
          // MongoDB'de batch'i güncelle (hata durumu)
          const failedBatch = await Batch.findOneAndUpdate(
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

          // Create error notification if batch has significant failures
          if (failedBatch && failedBatch.failedCount > 0 && failedBatch.failedCount % 5 === 0) {
            try {
              await createNotification({
                type: "error",
                title: "Toplu İşlem Hatası",
                message: `${failedBatch.failedCount} dosya işlenirken hata oluştu. Toplam ${failedBatch.processedCount}/${failedBatch.totalFiles} işlendi.`,
                link: `/dashboard/exams/${examId}/batch-upload`,
                metadata: {
                  batchId,
                  examId,
                  failedCount: failedBatch.failedCount,
                  processedCount: failedBatch.processedCount,
                  totalFiles: failedBatch.totalFiles,
                },
              });
            } catch (notifError) {
              console.error("Failed to create error notification:", notifError);
            }
          }
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

        // Create notification for batch completion
        try {
          await createNotification({
            type: "batch_complete",
            title: "Toplu İşlem Tamamlandı",
            message: `${finalBatch.totalFiles} dosya işlendi. ${finalBatch.successCount} başarılı, ${finalBatch.failedCount} başarısız.`,
            link: `/dashboard/exams/${examId}/batch-upload`,
            metadata: {
              batchId,
              examId,
              totalFiles: finalBatch.totalFiles,
              successCount: finalBatch.successCount,
              failedCount: finalBatch.failedCount,
            },
          });
        } catch (notifError) {
          console.error("Failed to create batch completion notification:", notifError);
        }
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

    // 3) Crop genel puan kutusu (warp if markers success, else template fallback)
    console.log(`📸 Starting crop process... Markers success: ${markers?.success || false}`);
    const totalScoreCrop = await cropTotalScoreBox(pngBuffer, markers);
    console.log(`✅ Cropped total score box: ${totalScoreCrop.imagePath || 'no path'}`);

    // 4) Gemini Vision: Genel puan okuma (tek kutu veya 20 kutu toplamı)
    console.log(`\n📊 Starting Gemini total score extraction...`);
    let totalScore = 0;
    let questionScores = [];
    try {
      if (totalScoreCrop.buffers && totalScoreCrop.buffers.length === 20) {
        const { extractScores } = await import("../utils/geminiVision.js");
        const rawScores = await extractScores(totalScoreCrop.buffers);
        totalScore = rawScores.reduce((a, b) => a + b, 0);
        questionScores = rawScores.map((score, i) => ({ questionNumber: i + 1, score }));
        console.log(`   ✅ Total score (20 boxes sum): ${totalScore}`);
      } else {
        console.log(`   Image path: ${totalScoreCrop.imagePath || 'in-memory'}`);
        totalScore = await extractNumberFromImage(totalScoreCrop.buffer);
        questionScores = [{ questionNumber: 1, score: totalScore }];
        console.log(`   ✅ Total score extracted: ${totalScore}`);
      }
    } catch (err) {
      console.error(`   ❌ Total score extraction failed:`, err.message);
      return res.status(500).json({
        success: false,
        message: `Genel puan okunamadı: ${err.message}`,
      });
    }
    
    // Calculate max score and percentage
    const maxTotalScore = exam.maxScore || 0;
    const percentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
    
    console.log(`📊 Total score: ${totalScore}/${maxTotalScore} (${percentage.toFixed(2)}%)`);

    // 5) Geçme notu: geçen tüm ÖÇ/PÇ geçer, kalan hepsinden kalır
    const passingScore = exam.passingScore != null ? Number(exam.passingScore) : 60;
    const passed = percentage >= passingScore;
    const successValue = passed ? 100 : 0;

    let outcomePerformance = {};
    let programOutcomePerformance = {};
    if (course && course.learningOutcomes && course.learningOutcomes.length > 0) {
      const examQuestions = exam.questions || [];
      const mappedLOCodes = new Set();
      examQuestions.forEach((q) => {
        if (q.learningOutcomeCode && q.learningOutcomeCode.trim() !== "") {
          mappedLOCodes.add(q.learningOutcomeCode);
        }
      });
      const relevantLOs = mappedLOCodes.size > 0
        ? course.learningOutcomes.filter((lo) => mappedLOCodes.has(lo.code))
        : course.learningOutcomes;
      const loPerformance = relevantLOs.map((lo) => ({
        code: lo.code,
        description: lo.description,
        success: successValue,
      }));
      outcomePerformance = Object.fromEntries(
        loPerformance.map((lo) => [lo.code, lo.success])
      );
      const poPerformance = calculateProgramOutcomePerformance(loPerformance, course);
      programOutcomePerformance = Object.fromEntries(
        poPerformance.map((po) => [po.code, po.success])
      );
    }

    // 6) DB kaydet veya güncelle: StudentExamResult (upsert)
    const resultDoc = await StudentExamResult.findOneAndUpdate(
      {
        studentNumber,
        examId,
      },
      {
        studentNumber,
        examId,
        courseId: exam.courseId,
        totalScore,
        maxScore: maxTotalScore,
        percentage: Math.round(percentage * 100) / 100,
        outcomePerformance,
        programOutcomePerformance,
        passed,
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
        scores: questionScores,
        totalScore,
        maxTotalScore,
        percentage: Math.round(percentage * 100) / 100,
        resultId: resultDoc._id,
        outcomePerformance,
        programOutcomePerformance,
        passed: resultDoc.passed,
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

// Kesilmiş puan kutusu görselini sun (şablon hatalarını kontrol için)
const getCropImage = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename || !/^[a-zA-Z0-9_-]+\.png$/.test(filename)) {
      return res.status(400).json({ success: false, message: "Geçersiz dosya adı" });
    }
    const cropDir = path.resolve(process.cwd(), "temp", "exam_crops");
    const filePath = path.resolve(cropDir, filename);
    if (!filePath.startsWith(cropDir + path.sep) && filePath !== cropDir) {
      return res.status(404).json({ success: false, message: "Görsel bulunamadı" });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Görsel bulunamadı" });
    }
    res.setHeader("Content-Type", "image/png");
    res.sendFile(filePath);
  } catch (err) {
    console.error("getCropImage error:", err);
    res.status(500).json({ success: false, message: "Görsel sunulamadı" });
  }
};

// Get all results for an exam (öğrenci adı-soyadı dahil)
const getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const results = await StudentExamResult.find({ examId })
      .populate("examId", "examCode examType")
      .populate("courseId", "code name")
      .sort({ createdAt: -1 })
      .lean();
    const studentNumbers = [...new Set(results.map((r) => r.studentNumber).filter(Boolean))];
    const students = await Student.find({ studentNumber: { $in: studentNumbers } }).select("studentNumber name").lean();
    const nameByNumber = Object.fromEntries(students.map((s) => [s.studentNumber, s.name || ""]));
    const data = results.map((r) => ({ ...r, studentName: nameByNumber[r.studentNumber] || "" }));
    return res.status(200).json({ success: true, data });
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
      .populate("examId", "examCode examType maxScore")
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

// Manual score entry endpoint (genel puan girişi)
const createOrUpdateStudentExamResult = async (req, res) => {
  try {
    const { studentNumber, examId, courseId, totalScore, percentage } = req.body;

    if (!studentNumber || !examId || !courseId || totalScore === undefined || percentage === undefined) {
      return res.status(400).json({
        success: false,
        message: "studentNumber, examId, courseId, totalScore ve percentage gereklidir",
      });
    }

    const maxScore = 100; // Her zaman 100

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Sınav bulunamadı" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Ders bulunamadı" });
    }

    // Geçme notu: sınavdaki passingScore (yoksa 60)
    const passingScore = exam.passingScore != null ? Number(exam.passingScore) : 60;
    const passed = Number(percentage) >= passingScore;

    // ÖÇ ve PÇ: geçen tümünden geçer, kalan hepsinden kalır (OBS kuralı)
    let outcomePerformance = {};
    let programOutcomePerformance = {};
    const successValue = passed ? 100 : 0;

    if (course && course.learningOutcomes && course.learningOutcomes.length > 0) {
      const examQuestions = exam.questions || [];
      const mappedLOCodes = new Set();
      examQuestions.forEach((q) => {
        if (q.learningOutcomeCode && q.learningOutcomeCode.trim() !== "") {
          mappedLOCodes.add(q.learningOutcomeCode);
        }
      });
      const relevantLOs = mappedLOCodes.size > 0
        ? course.learningOutcomes.filter((lo) => mappedLOCodes.has(lo.code))
        : course.learningOutcomes;
      outcomePerformance = Object.fromEntries(
        relevantLOs.map((lo) => [lo.code, successValue])
      );
      const loPerformance = relevantLOs.map((lo) => ({
        code: lo.code,
        description: lo.description,
        success: successValue,
      }));
      const poPerformance = calculateProgramOutcomePerformance(loPerformance, course);
      programOutcomePerformance = Object.fromEntries(
        poPerformance.map((po) => [po.code, po.success])
      );
    }

    // Upsert StudentExamResult
    const resultDoc = await StudentExamResult.findOneAndUpdate(
      {
        studentNumber,
        examId,
      },
      {
        studentNumber,
        examId,
        courseId,
        totalScore: Number(totalScore),
        maxScore: Number(maxScore),
        percentage: Math.round(Number(percentage) * 100) / 100,
        outcomePerformance,
        programOutcomePerformance,
        passed,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      data: resultDoc,
    });
  } catch (error) {
    console.error("createOrUpdateStudentExamResult error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Puan kaydedilemedi",
    });
  }
};

// OBS format: Toplu puan yükleme (Excel'den parse edilmiş liste – öğrenci no + puan)
// Body: { maxScore?: number, scores: [{ studentNumber: string, score: number }] }
const uploadScoresFromList = async (req, res) => {
  try {
    const { examId } = req.params;
    const { maxScore: bodyMaxScore = 100, scores: scoresList } = req.body;

    if (!scoresList || !Array.isArray(scoresList) || scoresList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "scores dizisi gereklidir (örn: [{ studentNumber: '20231021', score: 65 }])",
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Sınav bulunamadı" });
    }

    const course = await Course.findById(exam.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Ders bulunamadı" });
    }

    const maxScore = Number(bodyMaxScore) || 100;
    const passingScore = exam.passingScore != null ? Number(exam.passingScore) : 60;

    const results = { updated: 0, errors: [] };

    for (const item of scoresList) {
      const studentNumber = String(item.studentNumber ?? "").trim();
      const rawScore = Number(item.score);
      if (!studentNumber) {
        results.errors.push({ row: item, message: "Öğrenci numarası boş" });
        continue;
      }
      if (Number.isNaN(rawScore) || rawScore < 0) {
        results.errors.push({ studentNumber, message: "Geçersiz puan" });
        continue;
      }
      const totalScore = Math.min(rawScore, maxScore);
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      const passed = percentage >= passingScore;
      const successValue = passed ? 100 : 0;

      let outcomePerformance = {};
      let programOutcomePerformance = {};
      if (course.learningOutcomes && course.learningOutcomes.length > 0) {
        const examQuestions = exam.questions || [];
        const mappedLOCodes = new Set();
        examQuestions.forEach((q) => {
          if (q.learningOutcomeCode && q.learningOutcomeCode.trim() !== "") {
            mappedLOCodes.add(q.learningOutcomeCode);
          }
        });
        const relevantLOs = mappedLOCodes.size > 0
          ? course.learningOutcomes.filter((lo) => mappedLOCodes.has(lo.code))
          : course.learningOutcomes;
        outcomePerformance = Object.fromEntries(
          relevantLOs.map((lo) => [lo.code, successValue])
        );
        const loPerformance = relevantLOs.map((lo) => ({
          code: lo.code,
          description: lo.description,
          success: successValue,
        }));
        const poPerformance = calculateProgramOutcomePerformance(loPerformance, course);
        programOutcomePerformance = Object.fromEntries(
          poPerformance.map((po) => [po.code, po.success])
        );
      }

      try {
        await StudentExamResult.findOneAndUpdate(
          { studentNumber, examId },
          {
            studentNumber,
            examId,
            courseId: exam.courseId,
            totalScore,
            maxScore,
            percentage: Math.round(percentage * 100) / 100,
            outcomePerformance,
            programOutcomePerformance,
            passed,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        results.updated += 1;
      } catch (err) {
        results.errors.push({ studentNumber, message: err.message || "Kayıt hatası" });
      }
    }

    return res.status(200).json({
      success: true,
      data: { updated: results.updated, total: scoresList.length, errors: results.errors },
    });
  } catch (error) {
    console.error("uploadScoresFromList error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Toplu puan yüklenemedi",
    });
  }
};

export {
  createExam,
  getAllExams,
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
  createOrUpdateStudentExamResult,
  uploadScoresFromList,
  getCropImage,
};

