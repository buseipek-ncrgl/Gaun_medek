import express from "express";
import { getDepartments, seedDepartments, createDepartment, updateDepartment, deleteDepartment } from "../controllers/departmentController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getDepartments);
router.post("/seed", seedDepartments);
router.post("/", requireAuth, requireRole("super_admin"), createDepartment);
router.put("/:id", requireAuth, requireRole("super_admin"), updateDepartment);
router.delete("/:id", requireAuth, requireRole("super_admin"), deleteDepartment);

export default router;

