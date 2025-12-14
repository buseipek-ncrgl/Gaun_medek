import express from "express";
import {
  getQuestionLOPerformance,
  getLOAchievement,
  getPOAchievement,
  getStudentAchievements,
} from "../controllers/assessmentController.js";

const router = express.Router();

// GET /api/assessments/exam/:examId/question-lo-performance
router.get("/exam/:examId/question-lo-performance", getQuestionLOPerformance);

// GET /api/assessments/course/:courseId/lo-achievement
router.get("/course/:courseId/lo-achievement", getLOAchievement);

// GET /api/assessments/course/:courseId/po-achievement
router.get("/course/:courseId/po-achievement", getPOAchievement);

// GET /api/assessments/course/:courseId/student-achievements
router.get("/course/:courseId/student-achievements", getStudentAchievements);

export default router;

