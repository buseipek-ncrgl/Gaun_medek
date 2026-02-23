import Score from "../models/Score.js";
import Question from "../models/Question.js";
import Exam from "../models/Exam.js";
import Course from "../models/Course.js";
import Student from "../models/Student.js";
import StudentExamResult from "../models/StudentExamResult.js";

/**
 * MEDEK Assessment Logic
 * 
 * Question → ÖÇ → PÇ chain
 * 
 * 1. Questions map to ÖÇ codes (mappedLearningOutcomes: [String])
 * 2. ÖÇ definitions are in Course.learningOutcomes (embedded)
 * 3. Each ÖÇ has relatedProgramOutcomes: [String] (PÇ codes)
 * 4. PÇ success is derived from ÖÇ performance
 */

/**
 * Calculate Question → ÖÇ performance for an exam
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

    // Get all scores for this exam
    const questionIds = questions.map((q) => q._id);
    const scores = await Score.find({ examId, questionId: { $in: questionIds } });

    // Group scores by question
    const questionPerformance = questions.map((question) => {
      const questionScores = scores.filter(
        (s) => s.questionId.toString() === question._id.toString()
      );

      const totalScore = questionScores.reduce((sum, s) => sum + s.scoreValue, 0);
      const averageScore = questionScores.length > 0 
        ? totalScore / questionScores.length 
        : 0;
      const successRate = question.maxScore > 0
        ? (averageScore / question.maxScore) * 100
        : 0;

      return {
        questionNumber: question.number,
        maxScore: question.maxScore,
        learningOutcomeCodes: question.mappedLearningOutcomes || [],
        studentCount: questionScores.length,
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
      totalPercentageSum: 0,
      contributionCount: 0, // Her (öğrenci, sınav) katkısı = vize/final ortalaması için
    });
    });

    // Process StudentExamResult (yeni sistem - genel puan bazlı)
    studentResults.forEach((result) => {
      // Sadece bu derse kayıtlı öğrencileri işle
      if (!studentNumberSet.has(result.studentNumber)) {
        return;
      }

      const exam = exams.find(e => e._id.toString() === result.examId.toString());
      if (!exam) return;

      // Artık questionScores yok, outcomePerformance kullanılıyor
      // outcomePerformance: { "ÖÇ1": 75.5, "ÖÇ2": 82.3, ... } formatında
      // Her sınav sonucu (vize/final) yüzdesini ekle; ortalama = toplam / katkı sayısı
      if (result.outcomePerformance && typeof result.outcomePerformance === 'object' && Object.keys(result.outcomePerformance).length > 0) {
        Object.entries(result.outcomePerformance).forEach(([loCode, successPercentage]) => {
          if (loCode && loMap.has(loCode)) {
            const loData = loMap.get(loCode);
            loData.totalPercentageSum += Number(successPercentage) || 0;
            loData.contributionCount += 1;
          }
        });
      } else {
        const examQuestions = exam.questions || [];
        const mappedLOCodes = new Set();
        examQuestions.forEach((q) => {
          if (q.learningOutcomeCode && q.learningOutcomeCode.trim() !== "") {
            mappedLOCodes.add(q.learningOutcomeCode);
          }
        });
        const percentage = result.percentage || 0;
        if (mappedLOCodes.size > 0) {
          mappedLOCodes.forEach((loCode) => {
            if (loMap.has(loCode)) {
              const loData = loMap.get(loCode);
              loData.totalPercentageSum += percentage;
              loData.contributionCount += 1;
            }
          });
        } else {
          course.learningOutcomes.forEach((lo) => {
            const loData = loMap.get(lo.code);
            loData.totalPercentageSum += percentage;
            loData.contributionCount += 1;
          });
        }
      }
    });

    // Ortalama başarı yüzdesi: tüm (öğrenci, sınav) katkıları üzerinden = vize + final ortalaması
    const results = Array.from(loMap.values()).map((loData) => {
      const contributionCount = loData.contributionCount || 0;
      const achievedPercentage = contributionCount > 0
        ? (loData.totalPercentageSum || 0) / contributionCount
        : 0;

      return {
        code: loData.code,
        description: loData.description,
        relatedProgramOutcomes: loData.relatedProgramOutcomes,
        studentCount: studentNumberSet.size,
        averageScore: Math.round(achievedPercentage * 100) / 100,
        totalMaxScore: 100,
        achievedPercentage: Math.round(achievedPercentage * 100) / 100,
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

    // Use the same logic as getLOAchievement but return data for PÇ calculation
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
    const studentNumberSet = new Set(studentNumbers);

    // Calculate ÖÇ performance (same as getLOAchievement)
    const loMap = new Map();
    
    // Initialize with course learning outcomes
    course.learningOutcomes.forEach((lo) => {
      loMap.set(lo.code, {
        code: lo.code,
        description: lo.description,
        relatedProgramOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
        totalPercentageSum: 0, // Yüzde toplamı (ortalama hesaplamak için)
        studentsProcessed: new Set(),
      });
    });

    // Process StudentExamResult (yeni sistem - genel puan bazlı)
    studentResults.forEach((result) => {
      // Sadece bu derse kayıtlı öğrencileri işle
      if (!studentNumberSet.has(result.studentNumber)) {
        return;
      }

      const exam = exams.find(e => e._id.toString() === result.examId.toString());
      if (!exam) return;

      // Artık questionScores yok, outcomePerformance kullanılıyor
      // outcomePerformance: { "ÖÇ1": 75.5, "ÖÇ2": 82.3, ... } formatında
      if (result.outcomePerformance && typeof result.outcomePerformance === 'object') {
        Object.entries(result.outcomePerformance).forEach(([loCode, successPercentage]) => {
          if (loCode && loMap.has(loCode)) {
            const loData = loMap.get(loCode);
            // successPercentage zaten yüzde olarak geliyor (0-100 arası)
            // Ortalama hesaplamak için toplam yüzdeyi toplayıp öğrenci sayısına böleceğiz
            if (!loData.totalPercentageSum) {
              loData.totalPercentageSum = 0;
            }
            loData.totalPercentageSum += Number(successPercentage) || 0;
            loData.studentsProcessed.add(result.studentNumber);
          }
        });
      }
    });

    // Calculate ÖÇ achievement percentages
    const loAchievements = Array.from(loMap.values()).map((loData) => {
      const studentCount = loData.studentsProcessed?.size || 0;
      // Ortalama başarı yüzdesi: toplam yüzde / öğrenci sayısı
      const achievedPercentage = studentCount > 0
        ? (loData.totalPercentageSum || 0) / studentCount
        : 0;

      return {
        code: loData.code,
        description: loData.description,
        relatedProgramOutcomes: loData.relatedProgramOutcomes,
        achievedPercentage: Math.round(achievedPercentage * 100) / 100,
      };
    });

    if (loAchievements.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "Öğrenme çıktısı başarı verisi bulunamadı",
      });
    }

    // Build PÇ map from ÖÇ achievements
    const poMap = new Map();

    console.log('🔍 PÇ Hesaplama - ÖÇ Başarı Verileri:', JSON.stringify(loAchievements, null, 2));
    console.log('🔍 getPOAchievement - loAchievements count:', loAchievements.length);

    loAchievements.forEach((loAchievement) => {
      const relatedPOs = loAchievement.relatedProgramOutcomes || [];
      
      console.log(`  📊 ÖÇ ${loAchievement.code} -> PÇ'ler:`, relatedPOs, `(length: ${relatedPOs.length})`);
      console.log(`  📊 ÖÇ ${loAchievement.code} -> Başarı: ${loAchievement.achievedPercentage}%`);
      
      if (relatedPOs.length === 0) {
        console.warn(`  ⚠️ ÖÇ ${loAchievement.code} için PÇ eşleştirmesi bulunamadı!`);
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

    console.log('📈 Toplam PÇ Sayısı:', poMap.size);
    
    if (poMap.size === 0) {
      console.warn('⚠️ Hiç PÇ eşleştirmesi bulunamadı! Course.learningOutcomes içinde programOutcomes veya relatedProgramOutcomes kontrol edin.');
    }

    // Calculate average PÇ achievement
    const results = Array.from(poMap.values()).map((poData) => {
      const averageAchievement = poData.loAchievements.length > 0
        ? poData.loAchievements.reduce((sum, val) => sum + val, 0) / poData.loAchievements.length
        : 0;

      console.log(`  📈 PÇ ${poData.code}: ${averageAchievement.toFixed(2)}% (${poData.contributingLOs.length} ÖÇ katkısı)`);

      return {
        code: poData.code,
        achievedPercentage: Math.round(averageAchievement * 100) / 100,
        contributingLOs: poData.contributingLOs,
        contributingLOCount: poData.contributingLOs.length,
      };
    });
    
    console.log('📊 PÇ Başarı Özeti:', results.map(po => `${po.code}: ${po.achievedPercentage}%`).join(', '));

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
 * Helper function to get ÖÇ achievement data
 */
async function getLOAchievementData(courseId) {
  const course = await Course.findById(courseId).lean(); // Use lean() to get plain JavaScript object
  
  if (!course || !course.learningOutcomes || course.learningOutcomes.length === 0) {
    return [];
  }

  const exams = await Exam.find({ courseId });
  const examIds = exams.map((e) => e._id);

  if (examIds.length === 0) {
    return [];
  }

  const questions = await Question.find({ examId: { $in: examIds } });
  const questionIds = questions.map((q) => q._id);

  const scores = await Score.find({ questionId: { $in: questionIds } });

  const studentNumbers = course.students?.map((s) => s.studentNumber) || [];
  const students = await Student.find({ studentNumber: { $in: studentNumbers } });
  const studentIds = students.map((s) => s._id);

  const loMap = new Map();

  console.log('🔍 getLOAchievementData - Course learningOutcomes count:', course.learningOutcomes?.length || 0);
  console.log('🔍 getLOAchievementData - Raw learningOutcomes (first 2):', JSON.stringify(course.learningOutcomes?.slice(0, 2).map(lo => ({
    code: lo.code,
    programOutcomes: lo.programOutcomes,
    relatedProgramOutcomes: lo.relatedProgramOutcomes,
    allFields: Object.keys(lo), // Show all available fields
    hasProgramOutcomes: !!(lo.programOutcomes || lo.relatedProgramOutcomes)
  })), null, 2));

  course.learningOutcomes.forEach((lo) => {
    // Try multiple field names in case of different naming conventions
    const programOutcomes = lo.programOutcomes || lo.relatedProgramOutcomes || lo.mappedProgramOutcomes || [];
    
    console.log(`📚 ÖÇ ${lo.code} - PÇ'ler:`, programOutcomes, `(type: ${typeof programOutcomes}, isArray: ${Array.isArray(programOutcomes)}, length: ${programOutcomes?.length || 0})`);
    console.log(`  📋 ÖÇ ${lo.code} - Available fields:`, Object.keys(lo));
    
    if (!programOutcomes || programOutcomes.length === 0) {
      console.warn(`  ⚠️ ÖÇ ${lo.code} için PÇ eşleştirmesi YOK! Course'ta kayıtlı değil.`);
      console.warn(`  🔍 ÖÇ ${lo.code} - Raw object:`, JSON.stringify(lo, null, 2));
    }
    
    // Her öğrenci için ayrı hesaplama yapılacak - Map<studentId, {earned, max}>
    loMap.set(lo.code, {
      code: lo.code,
      description: lo.description,
      relatedProgramOutcomes: Array.isArray(programOutcomes) ? programOutcomes : [],
      studentScores: new Map(), // studentId -> { earned: number, max: number }
    });
  });

  // Önce her sorunun hangi ÖÇ'lere ait olduğunu ve max score'unu belirle
  questions.forEach((question) => {
    const loCodes = question.mappedLearningOutcomes || [];
    loCodes.forEach((loCode) => {
      if (loMap.has(loCode)) {
        // Bu soru bu ÖÇ'ye ait, max score'unu ekleyeceğiz
        // Ama öğrenci bazında ekleyeceğiz, bu yüzden şimdilik sadece question referansını tutuyoruz
      }
    });
  });

  // Öğrenci bazında hesaplama: Her öğrenci için ÖÇ yüzdesi hesapla, sonra ortalamasını al
  // Önce her öğrencinin her ÖÇ için puanlarını topla
  scores.forEach((score) => {
    if (!studentIds.includes(score.studentId.toString())) {
      return;
    }

    const question = questions.find(
      (q) => q._id.toString() === score.questionId.toString()
    );

    if (question) {
      const loCodes = question.mappedLearningOutcomes || [];
      loCodes.forEach((loCode) => {
        if (loMap.has(loCode)) {
          const loData = loMap.get(loCode);
          const studentId = score.studentId.toString();
          
          if (!loData.studentScores.has(studentId)) {
            loData.studentScores.set(studentId, { earned: 0, max: 0 });
          }
          
          const studentScore = loData.studentScores.get(studentId);
          studentScore.earned += score.scoreValue;
          studentScore.max += question.maxScore;
        }
      });
    }
  });

  // Her ÖÇ için: Öğrenci yüzdelerinin ortalamasını hesapla
  return Array.from(loMap.values()).map((loData) => {
    const studentPercentages = [];
    
    loData.studentScores.forEach((studentScore, studentId) => {
      if (studentScore.max > 0) {
        const percentage = (studentScore.earned / studentScore.max) * 100;
        studentPercentages.push(percentage);
      }
    });

    // Sınıf ortalaması: Tüm öğrenci yüzdelerinin ortalaması
    const achievedPercentage = studentPercentages.length > 0
      ? studentPercentages.reduce((sum, p) => sum + p, 0) / studentPercentages.length
      : 0;

    return {
      code: loData.code,
      description: loData.description,
      relatedProgramOutcomes: loData.relatedProgramOutcomes,
      achievedPercentage: Math.round(achievedPercentage * 100) / 100,
    };
  });
}

/**
 * Get student achievements matrix for a course
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
    const studentNumberSet = new Set(studentNumbers);

    // Build student achievement matrix: studentNumber -> { loCode -> percentage }
    const studentAchievementMap = new Map();

    // Initialize map for each student: loCode -> { sum, count } for vize+final average
    studentNumbers.forEach((studentNumber) => {
      studentAchievementMap.set(studentNumber, new Map());
      course.learningOutcomes.forEach((lo) => {
        studentAchievementMap.get(studentNumber).set(lo.code, {
          sum: 0,
          count: 0,
        });
      });
    });

    console.log(`📊 getStudentAchievements - Öğrenci sayısı: ${studentNumbers.length}`);
    console.log(`📊 getStudentAchievements - StudentExamResult sayısı: ${studentResults.length}`);
    console.log(`📊 getStudentAchievements - ÖÇ sayısı: ${course.learningOutcomes.length}`);

    // Process StudentExamResult
    studentResults.forEach((result) => {
      if (!studentNumberSet.has(result.studentNumber)) {
        return;
      }

      const exam = exams.find(e => e._id.toString() === result.examId.toString());
      if (!exam) {
        console.warn(`⚠️ Exam bulunamadı: ${result.examId}`);
        return;
      }

      const studentMap = studentAchievementMap.get(result.studentNumber);
      if (!studentMap) {
        console.warn(`⚠️ Öğrenci map'i bulunamadı: ${result.studentNumber}`);
        return;
      }

      // outcomePerformance: yüzde (0-100). Vize + final ortalaması için topla/say
      if (result.outcomePerformance && typeof result.outcomePerformance === 'object') {
        Object.entries(result.outcomePerformance).forEach(([loCode, successPercentage]) => {
          if (loCode && studentMap.has(loCode)) {
            const loData = studentMap.get(loCode);
            loData.sum += Number(successPercentage) || 0;
            loData.count += 1;
          }
        });
      }
    });

    // Convert to response format: { studentNumber: { loCode: percentage } }
    const achievements = {};
    let totalStudentsWithData = 0;
    let totalLOsWithData = 0;
    
    studentAchievementMap.forEach((loMap, studentNumber) => {
      achievements[studentNumber] = {};
      let hasData = false;
      
      loMap.forEach((loData, loCode) => {
        const percentage = loData.count > 0 ? loData.sum / loData.count : 0;
        achievements[studentNumber][loCode] = Math.round(percentage * 100) / 100;
        
        if (loData.count > 0) {
          hasData = true;
          totalLOsWithData++;
        }
      });
      
      if (hasData) {
        totalStudentsWithData++;
      }
    });

    console.log(`📊 getStudentAchievements - Sonuç özeti:`);
    console.log(`   Toplam öğrenci: ${studentNumbers.length}`);
    console.log(`   Veri olan öğrenci: ${totalStudentsWithData}`);
    console.log(`   Veri olan ÖÇ-öğrenci kombinasyonu: ${totalLOsWithData}`);
    console.log(`   Örnek veri (ilk öğrenci):`, studentNumbers.length > 0 ? achievements[studentNumbers[0]] : 'N/A');

    return res.status(200).json({
      success: true,
      data: achievements,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

