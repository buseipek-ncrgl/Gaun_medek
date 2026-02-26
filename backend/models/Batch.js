import mongoose from "mongoose";

const BatchStatusItemSchema = new mongoose.Schema({
  studentNumber: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ["success", "failed"],
    required: true,
  },
  message: {
    type: String,
    default: "",
  },
  /** Başarılı işlemde hesaplanan toplam puan (gösterim için). */
  totalScore: { type: Number, default: null },
  /** Soru bazlı puanlar [s1, s2, ...] (gösterim için). */
  questionScores: { type: [Number], default: undefined },
}, { _id: false });

const BatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    totalFiles: {
      type: Number,
      required: true,
      min: 0,
    },
    processedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    successCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    failedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    statuses: {
      type: [BatchStatusItemSchema],
      default: [],
    },
    isComplete: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
BatchSchema.index({ examId: 1, batchId: 1 });
BatchSchema.index({ isComplete: 1, createdAt: -1 });

// Method to check if batch is complete
BatchSchema.methods.checkComplete = function() {
  return this.processedCount >= this.totalFiles;
};

// Static method to find active batches
BatchSchema.statics.findActiveBatches = function(examId) {
  return this.find({
    examId,
    isComplete: false,
  }).sort({ createdAt: -1 });
};

export default mongoose.model("Batch", BatchSchema);




