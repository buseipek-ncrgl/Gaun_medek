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

// CREATE — admin, bölüm başkanı ve öğretmen (öğretmen sadece kendi eklediği dersleri görür)
router.post("/create", optionalAuth, requireAuth, requireRole("super_admin", "department_head", "teacher"), createCourse);

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

// UPDATE — admin, bölüm başkanı; öğretmen sadece kendi eklediği dersi
router.put("/:id", optionalAuth, requireAuth, requireRole("super_admin", "department_head", "teacher"), updateCourse);

// DELETE — admin, bölüm başkanı; öğretmen sadece kendi eklediği dersi
router.delete("/:id", optionalAuth, requireAuth, requireRole("super_admin", "department_head", "teacher"), deleteCourse);

export default router;
