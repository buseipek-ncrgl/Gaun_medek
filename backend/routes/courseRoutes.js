import express from "express";
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getCourseMatrix,
  seedCourses,
} from "../controllers/courseController.js";
import { getCourseReport } from "../controllers/reportController.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// CREATE — sadece yönetici ve bölüm başkanı
router.post("/create", optionalAuth, requireAuth, requireRole("super_admin", "department_head"), createCourse);

// SEED (get existing courses or seed sample)
router.post("/seed", seedCourses);

// GET ALL (optionalAuth: token varsa role göre filtre)
router.get("/", optionalAuth, getCourses);

// Course MEDEK matrix - Spesifik route, :id'den önce
router.get("/:id/matrix", getCourseMatrix);

// Course MEDEK raporu - Spesifik route, :id'den önce
router.get("/:id/report", getCourseReport);

// GET ONE (optionalAuth: rol varsa erişim kontrolü)
router.get("/:id", optionalAuth, getCourseById);

// UPDATE — sadece yönetici ve bölüm başkanı
router.put("/:id", optionalAuth, requireAuth, requireRole("super_admin", "department_head"), updateCourse);

// DELETE — sadece yönetici ve bölüm başkanı
router.delete("/:id", optionalAuth, requireAuth, requireRole("super_admin", "department_head"), deleteCourse);

export default router;
