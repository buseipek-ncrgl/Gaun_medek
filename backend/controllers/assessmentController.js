import Score from "../models/Score.js";
import Question from "../models/Question.js";
import Exam from "../models/Exam.js";
import Course from "../models/Course.js";
import Student from "../models/Student.js";
import StudentExamResult from "../models/StudentExamResult.js";

/**
 * MÜDEK Assessment Logic
 * 
 * Question → ÖÇ → PÇ chain
 * 
 * 1. Questions map to ÖÇ codes (mappedLearningOutcomes: [String])
 * 2. ÖÇ definitions are in Course.learningOutcomes (embedded)
 * 3. Each ÖÇ has relatedProgramOutcomes: [String] (PÇ codes)
 * 4. PÇ success is derived from ÖÇ performance
 */

/**
 * Calculate Question → ÖÇ performance for an exam (uses StudentExamResult - yeni sistem)
 * GET /api/assessments/exam/:examId/question-lo-performance
 */
export const getQuestionLOPerformance = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Sınav bulunamadı",
      });
    }

    // Get all questions for this exam
    const questions = await Question.find({ examId }).sort({ number: 1 });

    if (questions.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "Bu sınavda henüz soru yok",
      });
    }

    // Get all StudentExamResult for this exam (yeni sistem)
    const studentResults = await StudentExamResult.find({ examId });

    // Create a map: questionNumber -> learningOutcomeCode
    const questionLOMap = new Map();
    questions.forEach((q) => {
      const loCodes = q.mappedLearningOutcomes || [];
      if (loCodes.length > 0) {
        questionLOMap.set(q.number, loCodes[0]); // İlk ÖÇ kodunu kullan
      }
    });

    // Group scores by question number
    const questionPerformanceMap = new Map();
    
    // Initialize with questions
    questions.forEach((question) => {
      questionPerformanceMap.set(question.number, {
        questionNumber: question.number,
        maxScore: exam.maxScorePerQuestion || question.maxScore || 0,
        learningOutcomeCodes: question.mappedLearningOutcomes || [],
        totalScore: 0,
        studentCount: 0,
      });
    });

    // Process StudentExamResult
    studentResults.forEach((result) => {
      (result.questionScores || []).forEach((qs) => {
        const questionNum = qs.questionNumber;
        if (questionPerformanceMap.has(questionNum)) {
          const perf = questionPerformanceMap.get(questionNum);
          perf.totalScore += qs.score || 0;
          perf.studentCount += 1;
        }
      });
    });

    // Calculate averages and success rates
    const questionPerformance = Array.from(questionPerformanceMap.values()).map((perf) => {
      const averageScore = perf.studentCount > 0 
        ? perf.totalScore / perf.studentCount 
        : 0;
      const successRate = perf.maxScore > 0
        ? (averageScore / perf.maxScore) * 100
        : 0;

      return {
        questionNumber: perf.questionNumber,
        maxScore: perf.maxScore,
        learningOutcomeCodes: perf.learningOutcomeCodes,
        studentCount: perf.studentCount,
        averageScore: Math.round(averageScore * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
      };
    });

    return res.status(200).json({
      success: true,
      data: questionPerformance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Calculate ÖÇ achievement for a course (all students)
 * GET /api/assessments/course/:courseId/lo-achievement
 */
export const getLOAchievement = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Ders bulunamadı",
      });
    }

    if (!course.learningOutcomes || course.learningOutcomes.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "Bu ders için öğrenme çıktısı tanımlanmamış",
      });
    }

    // Get all exams for this course
    const exams = await Exam.find({ courseId });
    const examIds = exams.map((e) => e._id);

    if (examIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "Bu ders için sınav bulunamadı",
      });
    }

    // Get all StudentExamResult for this course (yeni sistem)
    const studentResults = await StudentExamResult.find({ 
      courseId: courseId,
      examId: { $in: examIds }
    });

    // Get all students for this course
    const studentNumbers = course.students?.map((s) => s.studentNumber) || [];
    const students = await Student.find({ studentNumber: { $in: studentNumbers } });
    const studentNumberSet = new Set(studentNumbers);

    // Calculate ÖÇ performance
    const loMap = new Map();

    // Initialize with course learning outcomes
    course.learningOutcomes.forEach((lo) => {
      loMap.set(lo.code, {
        code: lo.code,
        description: lo.description,
        relatedProgramOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
        totalScoreEarned: 0,
        totalMaxScore: 0,
        studentsProcessed: new Set(),
      });
    });

    // Öğrenci bazında ÖÇ puanlarını hesapla
    // Her öğrenci için: ÖÇ puanı = (ÖÇ'yi ölçen sorulardan alınan puan / Bu soruların toplam puanı) × 100
    const studentLOPercentages = new Map(); // studentNumber -> { loCode -> percentage }

    studentResults.forEach((result) => {
      if (!studentNumberSet.has(result.studentNumber)) {
        return;
      }

      const exam = exams.find(e => e._id.toString() === result.examId.toString());
      if (!exam) return;

      // Her öğrenci için ÖÇ bazında puanları topla
      const studentLOData = new Map(); // loCode -> { totalScore, totalMaxScore }
      
      // Initialize with course learning outcomes
      course.learningOutcomes.forEach((lo) => {
        studentLOData.set(lo.code, {
          totalScore: 0,
          totalMaxScore: 0,
        });
      });

      // Process each question score
      (result.questionScores || []).forEach((qs) => {
        const loCode = qs.learningOutcomeCode;
        if (loCode && studentLOData.has(loCode)) {
          const loData = studentLOData.get(loCode);
          loData.totalScore += qs.score || 0;
          loData.totalMaxScore += exam.maxScorePerQuestion || 0;
        }
      });

      // Her öğrenci için ÖÇ yüzdelerini hesapla: ÖÇ puanı = (ÖÇ'yi ölçen sorulardan alınan puan / Bu soruların toplam puanı) × 100
      const studentPercentages = {};
      studentLOData.forEach((loData, loCode) => {
        if (loData.totalMaxScore > 0) {
          const percentage = (loData.totalScore / loData.totalMaxScore) * 100;
          studentPercentages[loCode] = percentage;
        }
      });

      studentLOPercentages.set(result.studentNumber, studentPercentages);
    });

    // Sınıf ortalaması: ÖÇ ortalaması = (Σ ÖÇ yüzdeleri) / Öğrenci sayısı
    const results = Array.from(loMap.values()).map((loData) => {
      const loCode = loData.code;
      const percentages = [];
      
      // Her öğrencinin bu ÖÇ için yüzdesini topla
      studentLOPercentages.forEach((studentPercentages) => {
        if (studentPercentages[loCode] !== undefined) {
          percentages.push(studentPercentages[loCode]);
        }
      });

      // Sınıf ortalaması
      const studentCount = percentages.length;
      const averagePercentage = studentCount > 0
        ? percentages.reduce((sum, p) => sum + p, 0) / studentCount
        : 0;

      return {
        code: loData.code,
        description: loData.description,
        relatedProgramOutcomes: loData.relatedProgramOutcomes,
        studentCount,
        averageScore: 0, // Artık kullanılmıyor, ama geriye uyumluluk için
        totalMaxScore: 0, // Artık kullanılmıyor, ama geriye uyumluluk için
        achievedPercentage: Math.round(averagePercentage * 100) / 100,
      };
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Calculate PÇ achievement derived from ÖÇ performance
 * GET /api/assessments/course/:courseId/po-achievement
 */
export const getPOAchievement = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Ders bulunamadı",
      });
    }

    // First get ÖÇ achievements
    const loAchievements = await getLOAchievementData(courseId);

    console.log(`📊 PÇ hesaplama: ${loAchievements.length} ÖÇ başarı verisi bulundu`);

    if (loAchievements.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "Öğrenme çıktısı başarı verisi bulunamadı",
      });
    }

    // Build PÇ map from ÖÇ achievements
    const poMap = new Map();

    loAchievements.forEach((loAchievement) => {
      const relatedPOs = loAchievement.relatedProgramOutcomes || [];
      console.log(`  📋 ÖÇ ${loAchievement.code}: ${relatedPOs.length} PÇ ile ilişkili (${relatedPOs.join(', ')})`);
      
      if (relatedPOs.length === 0) {
        console.warn(`  ⚠️ ÖÇ ${loAchievement.code} için PÇ ilişkisi tanımlanmamış`);
      }
      
      relatedPOs.forEach((poCode) => {
        if (!poMap.has(poCode)) {
          poMap.set(poCode, {
            code: poCode,
            loAchievements: [],
            contributingLOs: [],
          });
        }
        
        poMap.get(poCode).loAchievements.push(loAchievement.achievedPercentage);
        poMap.get(poCode).contributingLOs.push({
          code: loAchievement.code,
          achievedPercentage: loAchievement.achievedPercentage,
        });
      });
    });

    console.log(`📊 PÇ haritası: ${poMap.size} farklı PÇ bulundu`);

    // Calculate average PÇ achievement
    const results = Array.from(poMap.values()).map((poData) => {
      const averageAchievement = poData.loAchievements.length > 0
        ? poData.loAchievements.reduce((sum, val) => sum + val, 0) / poData.loAchievements.length
        : 0;

      return {
        code: poData.code,
        achievedPercentage: Math.round(averageAchievement * 100) / 100,
        contributingLOs: poData.contributingLOs,
        contributingLOCount: poData.contributingLOs.length,
      };
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Helper function to get ÖÇ achievement data (uses StudentExamResult - yeni sistem)
 */
async function getLOAchievementData(courseId) {
  const course = await Course.findById(courseId);
  
  if (!course || !course.learningOutcomes || course.learningOutcomes.length === 0) {
    return [];
  }

  const exams = await Exam.find({ courseId });
  const examIds = exams.map((e) => e._id);

  if (examIds.length === 0) {
    return [];
  }

  // Get all StudentExamResult for this course (yeni sistem)
  const studentResults = await StudentExamResult.find({ 
    courseId: courseId,
    examId: { $in: examIds }
  });

  // Get all students for this course
  const studentNumbers = course.students?.map((s) => s.studentNumber) || [];
  const studentNumberSet = new Set(studentNumbers);

  const loMap = new Map();

  // Initialize with course learning outcomes
  course.learningOutcomes.forEach((lo) => {
    loMap.set(lo.code, {
      code: lo.code,
      description: lo.description,
      relatedProgramOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
      totalScoreEarned: 0,
      totalMaxScore: 0,
      studentsProcessed: new Set(),
    });
  });

  // Öğrenci bazında ÖÇ puanlarını hesapla (getLOAchievement ile aynı mantık)
  const studentLOPercentages = new Map(); // studentNumber -> { loCode -> percentage }

  studentResults.forEach((result) => {
    if (!studentNumberSet.has(result.studentNumber)) {
      return;
    }

    const exam = exams.find(e => e._id.toString() === result.examId.toString());
    if (!exam) return;

    // Her öğrenci için ÖÇ bazında puanları topla
    const studentLOData = new Map(); // loCode -> { totalScore, totalMaxScore }
    
    // Initialize with course learning outcomes
    course.learningOutcomes.forEach((lo) => {
      studentLOData.set(lo.code, {
        totalScore: 0,
        totalMaxScore: 0,
      });
    });

    // Process each question score
    (result.questionScores || []).forEach((qs) => {
      const loCode = qs.learningOutcomeCode;
      if (loCode && studentLOData.has(loCode)) {
        const loData = studentLOData.get(loCode);
        loData.totalScore += qs.score || 0;
        loData.totalMaxScore += exam.maxScorePerQuestion || 0;
      }
    });

    // Her öğrenci için ÖÇ yüzdelerini hesapla: ÖÇ puanı = (ÖÇ'yi ölçen sorulardan alınan puan / Bu soruların toplam puanı) × 100
    const studentPercentages = {};
    studentLOData.forEach((loData, loCode) => {
      if (loData.totalMaxScore > 0) {
        const percentage = (loData.totalScore / loData.totalMaxScore) * 100;
        studentPercentages[loCode] = percentage;
      }
    });

    studentLOPercentages.set(result.studentNumber, studentPercentages);
  });

  // Sınıf ortalaması: ÖÇ ortalaması = (Σ ÖÇ yüzdeleri) / Öğrenci sayısı
  return Array.from(loMap.values()).map((loData) => {
    const loCode = loData.code;
    const percentages = [];
    
    // Her öğrencinin bu ÖÇ için yüzdesini topla
    studentLOPercentages.forEach((studentPercentages) => {
      if (studentPercentages[loCode] !== undefined) {
        percentages.push(studentPercentages[loCode]);
      }
    });

    // Sınıf ortalaması
    const studentCount = percentages.length;
    const averagePercentage = studentCount > 0
      ? percentages.reduce((sum, p) => sum + p, 0) / studentCount
      : 0;

    return {
      code: loData.code,
      description: loData.description,
      relatedProgramOutcomes: loData.relatedProgramOutcomes || [],
      achievedPercentage: Math.round(averagePercentage * 100) / 100,
    };
  });
}

/**
 * Get student achievements per student for a course
 * GET /api/assessments/course/:courseId/student-achievements
 */
export const getStudentAchievements = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Ders bulunamadı",
      });
    }

    if (!course.learningOutcomes || course.learningOutcomes.length === 0) {
      return res.status(200).json({
        success: true,
        data: {},
        message: "Bu ders için öğrenme çıktısı tanımlanmamış",
      });
    }

    // Get all exams for this course
    const exams = await Exam.find({ courseId });
    const examIds = exams.map((e) => e._id);

    if (examIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {},
        message: "Bu ders için sınav bulunamadı",
      });
    }

    // Get all StudentExamResult for this course
    const studentResults = await StudentExamResult.find({ 
      courseId: courseId,
      examId: { $in: examIds }
    });

    // Get all students for this course
    const studentNumbers = course.students?.map((s) => s.studentNumber) || [];
    const students = await Student.find({ studentNumber: { $in: studentNumbers } });
    const studentNumberSet = new Set(studentNumbers);
    const studentIdMap = new Map(); // studentNumber -> studentId
    students.forEach(s => {
      studentIdMap.set(s.studentNumber, s._id.toString());
    });

    // Initialize student achievement map: studentId -> { loCode -> { totalScore, totalMaxScore, count } }
    const studentAchievementMap = new Map();
    
    students.forEach(student => {
      const studentId = student._id.toString();
      studentAchievementMap.set(studentId, {
        studentId,
        studentNumber: student.studentNumber,
        achievements: new Map()
      });
      
      // Initialize with course learning outcomes
      course.learningOutcomes.forEach((lo) => {
        studentAchievementMap.get(studentId).achievements.set(lo.code, {
          code: lo.code,
          description: lo.description,
          totalScoreEarned: 0,
          totalMaxScore: 0,
          questionCount: 0,
        });
      });
    });

    // Process StudentExamResult
    studentResults.forEach((result) => {
      if (!studentNumberSet.has(result.studentNumber)) {
        return;
      }

      const studentId = studentIdMap.get(result.studentNumber);
      if (!studentId || !studentAchievementMap.has(studentId)) {
        return;
      }

      const exam = exams.find(e => e._id.toString() === result.examId.toString());
      if (!exam) return;

      const studentData = studentAchievementMap.get(studentId);

      // Process each question score
      (result.questionScores || []).forEach((qs) => {
        const loCode = qs.learningOutcomeCode;
        if (loCode && studentData.achievements.has(loCode)) {
          const loAchievement = studentData.achievements.get(loCode);
          loAchievement.totalScoreEarned += qs.score || 0;
          loAchievement.totalMaxScore += exam.maxScorePerQuestion || 0;
          loAchievement.questionCount += 1;
        }
      });
    });

    // Calculate achievement percentages and format response
    const response = {};
    
    studentAchievementMap.forEach((studentData) => {
      const achievements = Array.from(studentData.achievements.values()).map((loAchievement) => {
        const achievedPercentage = loAchievement.totalMaxScore > 0
          ? (loAchievement.totalScoreEarned / loAchievement.totalMaxScore) * 100
          : 0;

        return {
          learningOutcome: {
            _id: loAchievement.code,
            code: loAchievement.code,
            description: loAchievement.description,
          },
          achievedPercentage: Math.round(achievedPercentage * 100) / 100,
          totalScoreEarned: loAchievement.totalScoreEarned,
          totalMaxScore: loAchievement.totalMaxScore,
        };
      });

      response[studentData.studentId] = achievements;
    });

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

