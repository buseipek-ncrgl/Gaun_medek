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
  },
  {
    timestamps: true,
  }
);

// Unique constraint: Aynı öğrenci aynı sınavda sadece bir sonuç kaydı olabilir
StudentExamResultSchema.index({ studentNumber: 1, examId: 1 }, { unique: true });

const StudentExamResult = mongoose.model("StudentExamResult", StudentExamResultSchema);

export default StudentExamResult;

