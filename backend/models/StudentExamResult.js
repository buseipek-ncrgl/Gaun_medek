import mongoose from "mongoose";

const StudentExamResultSchema = new mongoose.Schema(
  {
    studentNumber: { type: String, required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    // Genel puan sistemi - soru bazlı değil
    totalScore: { type: Number, required: true }, // Alınan toplam puan
    maxScore: { type: Number, required: true }, // Maksimum puan (exam.questionCount * exam.maxScorePerQuestion)
    percentage: { type: Number, required: true }, // Yüzde (totalScore / maxScore * 100)
    outcomePerformance: { type: Object, default: {} }, // ÖÇ performansları
    programOutcomePerformance: { type: Object, default: {} }, // PÇ performansları
    // Geçme: percentage >= exam.passingScore ise true; geçen tüm ÖÇ/PÇ geçer, kalan hepsinden kalır
    passed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: Aynı öğrenci aynı sınavda sadece bir sonuç kaydı olabilir
StudentExamResultSchema.index({ studentNumber: 1, examId: 1 }, { unique: true });

// Additional indexes for performance optimization
StudentExamResultSchema.index({ examId: 1 }); // Sık kullanılan: exam'a göre sonuç arama
StudentExamResultSchema.index({ courseId: 1 }); // Course'a göre sonuç arama
StudentExamResultSchema.index({ studentNumber: 1 }); // Öğrenci numarasına göre arama
StudentExamResultSchema.index({ percentage: -1 }); // Yüzdeye göre sıralama
StudentExamResultSchema.index({ createdAt: -1 }); // Son eklenen sonuçlar için

const StudentExamResult = mongoose.model("StudentExamResult", StudentExamResultSchema);

export default StudentExamResult;

