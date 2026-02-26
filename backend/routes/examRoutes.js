import express from "express";
import multer from "multer";
import {
  createExam,
  getAllExams,
  getExamsByCourse,
  getExamById,
  updateExam,
  deleteExam,
  submitExamScores,
  getExamResults,
  getExamResultsByStudent,
  getQuestionScoresForStudent,
  startBatchScore,
  getBatchStatus,
  createOrUpdateStudentExamResult,
  uploadScoresFromList,
  getCropImage,
} from "../controllers/examController.js";
import { getExamAnalysis } from "../controllers/reportController.js";
import { validate, examSchemas, studentExamResultSchemas } from "../middleware/validation.js";
import { asyncHandler } from "../utils/errorHandler.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// CREATE - Spesifik route'lar önce gelmeli
router.post("/create", validate(examSchemas.create, 'body'), asyncHandler(createExam));
// Backward compatibility
router.post("/", validate(examSchemas.create, 'body'), asyncHandler(createExam));

// GET /api/exams - Get all exams (optionalAuth: role göre filtre)
router.get("/", optionalAuth, asyncHandler(getAllExams));
// Kesilmiş puan kutusu görseli (şablon kontrolü) - /:examId'den önce olmalı
router.get("/crop-image/:filename", getCropImage);

// GET /api/exams/course/:courseId (optionalAuth: rol varsa erişim kontrolü)
router.get("/course/:courseId", optionalAuth, validate(examSchemas.getByCourse, 'params'), asyncHandler(getExamsByCourse));

// Get exam results by student number - MUST be before /:examId routes
router.get("/student/:studentNumber/results", getExamResultsByStudent);

// Score submission (PDF upload or base64) - POST routes
router.post("/:examId/score", upload.single("file"), submitExamScores);
// Batch score (multiple PDFs) - POST routes
router.post("/:examId/batch-score", upload.array("files"), startBatchScore);
// Manual score entry (genel puan girişi) - POST route
router.post("/:examId/manual-score", validate(studentExamResultSchemas.createOrUpdate, 'body'), asyncHandler(createOrUpdateStudentExamResult));
// OBS Excel toplu puan yükleme (body: { maxScore?, scores: [{ studentNumber, score }] })
router.post("/:examId/upload-scores", asyncHandler(uploadScoresFromList));

// GET routes with sub-paths - MUST be before /:id route to avoid conflict
router.get("/:examId/batch-status", asyncHandler(getBatchStatus));
router.get("/:examId/results", asyncHandler(getExamResults));
router.get("/:examId/results/:studentNumber/question-scores", asyncHandler(getQuestionScoresForStudent));
router.get("/:id/analysis", validate(examSchemas.getById, 'params'), asyncHandler(getExamAnalysis));

// GET /api/exams/:id - Genel route en sonda (least specific)
router.get("/:id", validate(examSchemas.getById, 'params'), asyncHandler(getExamById));

// PUT /api/exams/:id
router.put("/:id", validate(examSchemas.update, 'body'), asyncHandler(updateExam));

// DELETE /api/exams/:id
router.delete("/:id", validate(examSchemas.getById, 'params'), asyncHandler(deleteExam));

export default router;

