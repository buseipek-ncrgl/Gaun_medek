import mongoose from "mongoose";

const CourseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    semester: String,
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
    },
    description: String,

    learningOutcomes: [
      {
        code: String,
        description: String,
        programOutcomes: [String], // PÇ codes (e.g., ["PÇ1", "PÇ2"])
      },
    ],

    midtermExam: {
      examCode: String,
      questionCount: Number,
      maxScorePerQuestion: Number,
      /** Soru bazlı max puan (opsiyonel; length = questionCount). */
      questionMaxScores: [Number],
    },

    finalExam: {
      examCode: String,
      questionCount: Number,
      maxScorePerQuestion: Number,
      /** Soru bazlı max puan (opsiyonel; length = questionCount). */
      questionMaxScores: [Number],
    },

    /** Raporlarda kullanılacak geçme yüzdesi (0-100). Boşsa sınavların geçme puanlarının en düşüğü kullanılır. */
    reportPassingThreshold: { type: Number, min: 0, max: 100, default: null },

    students: [
      {
        studentNumber: String,
        fullName: String,
      },
    ],
    // Öğretmen ataması: bu dersi görebilecek kullanıcı (teacher rolü)
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// Database Indexes for performance optimization
CourseSchema.index({ code: 1 }, { unique: true }); // Unique index zaten var ama açıkça belirtiyoruz
CourseSchema.index({ department: 1 }); // Department'a göre arama
CourseSchema.index({ program: 1 }); // Program'a göre arama
CourseSchema.index({ department: 1, program: 1 }); // Composite index: department + program
CourseSchema.index({ createdAt: -1 }); // Son eklenen dersler için

export default mongoose.model("Course", CourseSchema);
