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

// 2) ÖÇ performansı: Sınav bazlı ÖÇ eşleme - sadece sınavın eşlendiği ÖÇ'ler için hesapla
export function calculateOutcomePerformance(studentResults, exam, course) {
  // Sınavın eşlendiği ÖÇ kodlarını al
  const examLOs = exam?.learningOutcomes || [];
  
  // Eğer sınav için ÖÇ eşlemesi yoksa, course'daki tüm ÖÇ'leri kullan (fallback)
  const loDefs = course?.learningOutcomes || [];
  
  // Tüm öğrencilerin genel puan yüzdelerini topla
  const percentages = [];
  (studentResults || []).forEach((result) => {
    if (result.percentage !== undefined && result.percentage !== null) {
      percentages.push(Number(result.percentage || 0));
    }
  });
  
  // Ortalama yüzdeyi hesapla
  const avgPercentage = percentages.length
    ? percentages.reduce((a, b) => a + b, 0) / percentages.length
    : 0;

  // Sınav bazlı ÖÇ eşleme varsa sadece onları kullan, yoksa tüm ÖÇ'leri kullan
  const relevantLOs = examLOs.length > 0
    ? loDefs.filter((lo) => examLOs.includes(lo.code))
    : loDefs;

  // Her ÖÇ için genel puan yüzdesini kullan
  return relevantLOs.map((lo) => ({
    code: lo.code,
    description: lo.description,
    programOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
    success: Number(avgPercentage.toFixed(2)),
    studentCount: percentages.length,
  }));
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


