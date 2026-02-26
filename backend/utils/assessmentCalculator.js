/**
 * MEDEK Hesaplama Yardımcıları
 * Girdi: StudentExamResult listesi, Exam, Course
 * Çıktı: Genel Puan → ÖÇ → PÇ performansları ve rapor
 */

// 1) Genel puan analizi: ortalama, başarı yüzdesi
export function calculateTotalScoreAnalysis(studentResults, exam) {
  const maxTotalScore = exam?.maxScore || 0;
  
  // Genel puanları topla
  const totalScores = [];
  const percentages = [];
  
  (studentResults || []).forEach((result) => {
    if (result.totalScore !== undefined && result.totalScore !== null) {
      totalScores.push(Number(result.totalScore || 0));
      percentages.push(Number(result.percentage || 0));
    }
  });

  // Hesapla
  const avgTotalScore = totalScores.length
    ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length
    : 0;
  const avgPercentage = percentages.length
    ? percentages.reduce((a, b) => a + b, 0) / percentages.length
    : 0;

  return {
    averageTotalScore: Number(avgTotalScore.toFixed(2)),
    averagePercentage: Number(avgPercentage.toFixed(2)),
    maxTotalScore,
    studentCount: totalScores.length,
    minScore: totalScores.length ? Math.min(...totalScores) : 0,
    maxScore: totalScores.length ? Math.max(...totalScores) : 0,
  };
}

// 2) ÖÇ performansı: Her ÖÇ için öğrenci bazlı outcomePerformance yüzdelerinin ortalaması
export function calculateOutcomePerformance(studentResults, exam, course) {
  const examLOs = exam?.learningOutcomes || [];
  const loDefs = course?.learningOutcomes || [];
  let relevantLOs = examLOs.length > 0
    ? loDefs.filter((lo) => examLOs.includes(lo.code))
    : loDefs;
  if (relevantLOs.length === 0 && exam?.questions?.length) {
    const codesFromQuestions = new Set();
    exam.questions.forEach((q) => {
      const codes = q.learningOutcomeCodes || (q.learningOutcomeCode ? [q.learningOutcomeCode] : []);
      codes.filter(Boolean).forEach((c) => codesFromQuestions.add(String(c).trim()));
    });
    if (codesFromQuestions.size > 0) {
      relevantLOs = loDefs.filter((lo) => codesFromQuestions.has(lo.code));
    }
  }
  if (relevantLOs.length === 0) relevantLOs = loDefs;

  // Genel puan ortalaması (outcomePerformance yoksa fallback)
  const generalPercentages = [];
  (studentResults || []).forEach((result) => {
    if (result.percentage != null) generalPercentages.push(Number(result.percentage) || 0);
  });
  const avgGeneral = generalPercentages.length
    ? generalPercentages.reduce((a, b) => a + b, 0) / generalPercentages.length
    : 0;

  // Her ÖÇ için: öğrenci sonuçlarındaki outcomePerformance[ÖÇ] değerlerini topla, ortalama al
  return relevantLOs.map((lo) => {
    const perStudent = [];
    (studentResults || []).forEach((result) => {
      const op = result.outcomePerformance;
      if (op && typeof op === "object" && op[lo.code] != null) {
        perStudent.push(Number(op[lo.code]) || 0);
      } else if (result.percentage != null) {
        perStudent.push(Number(result.percentage) || 0);
      }
    });
    const success = perStudent.length > 0
      ? perStudent.reduce((a, b) => a + b, 0) / perStudent.length
      : avgGeneral;
    return {
      code: lo.code,
      description: lo.description,
      programOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
      success: Number(Number(success).toFixed(2)),
      studentCount: perStudent.length || generalPercentages.length,
    };
  });
}

// 3) PÇ performansı: ÖÇ sonuçlarından türet
export function calculateProgramOutcomePerformance(outcomePerformance, course) {
  const poMap = new Map();

  (outcomePerformance || []).forEach((lo) => {
    (lo.programOutcomes || lo.relatedProgramOutcomes || []).forEach((poCode) => {
      if (!poMap.has(poCode)) {
        poMap.set(poCode, {
          code: poCode,
          contributions: [],
        });
      }
      poMap.get(poCode).contributions.push(lo.success);
    });
  });

  return Array.from(poMap.values()).map((po) => {
    const avg =
      po.contributions.length === 0
        ? 0
        : po.contributions.reduce((a, b) => a + b, 0) / po.contributions.length;
    return {
      code: po.code,
      success: Number(avg.toFixed(2)),
      contributionCount: po.contributions.length,
    };
  });
}

// 4) Tam rapor
export function buildMudekReport(course, exam, studentResults) {
  const totalScoreAnalysis = calculateTotalScoreAnalysis(studentResults, exam);
  const outcomePerformance = calculateOutcomePerformance(
    studentResults,
    exam,
    course
  );
  const programOutcomePerformance = calculateProgramOutcomePerformance(
    outcomePerformance,
    course
  );

  // Basit özet öneri
  const avgPercentage = totalScoreAnalysis.averagePercentage;
  const recommendations = avgPercentage < 60
    ? `Genel başarı oranı %${avgPercentage.toFixed(2)} ile MEDEK hedef eşiğinin (%60) altında. Ders içeriği ve öğretim yöntemleri gözden geçirilmeli.`
    : avgPercentage < 70
    ? `Genel başarı oranı %${avgPercentage.toFixed(2)} ile kabul edilebilir seviyede. İyileştirme için öğrenme çıktılarına göre detaylı analiz yapılmalı.`
    : `Genel başarı oranı %${avgPercentage.toFixed(2)} ile iyi seviyede.`;

  return {
    totalScoreAnalysis,
    learningOutcomeAnalysis: outcomePerformance,
    programOutcomeAnalysis: programOutcomePerformance,
    summary: { recommendations },
  };
}


