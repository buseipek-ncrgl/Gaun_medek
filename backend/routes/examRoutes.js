import express from "express";
import multer from "multer";
import {
  createExam,
  getExamsByCourse,
  getExamById,
  updateExam,
  deleteExam,
  submitExamScores,
  getExamResults,
  getExamResultsByStudent,
  startBatchScore,
  getBatchStatus,
  createOrUpdateStudentExamResult,
} from "../controllers/examController.js";
import { getExamAnalysis } from "../controllers/reportController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// CREATE - Spesifik route'lar önce gelmeli
router.post("/create", createExam);
// Backward compatibility
router.post("/", createExam);

// GET /api/exams/course/:courseId - Spesifik route, :id'den önce
router.get("/course/:courseId", getExamsByCourse);

// Get exam results by student number - MUST be before /:examId routes
router.get("/student/:studentNumber/results", getExamResultsByStudent);

// Score submission (PDF upload or base64) - POST routes
router.post("/:examId/score", upload.single("file"), submitExamScores);
// Batch score (multiple PDFs) - POST routes
router.post("/:examId/batch-score", upload.array("files"), startBatchScore);
// Manual score entry (genel puan girişi) - POST route
router.post("/:examId/manual-score", createOrUpdateStudentExamResult);

// GET routes with sub-paths - MUST be before /:id route to avoid conflict
// These are more specific than /:id, so they must come first
router.get("/:examId/batch-status", getBatchStatus);
router.get("/:examId/results", getExamResults);
router.get("/:id/analysis", getExamAnalysis);

// GET /api/exams/:id - Genel route en sonda (least specific)
router.get("/:id", getExamById);

// PUT /api/exams/:id
router.put("/:id", updateExam);

// DELETE /api/exams/:id
router.delete("/:id", deleteExam);

export default router;

