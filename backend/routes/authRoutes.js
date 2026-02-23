import express from "express";
import { login, me, updateMe, seedAdmin, seedDemo, listUsers, createUser, updateUser, deleteUser } from "../controllers/authController.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/seed-admin", seedAdmin);
router.post("/seed-demo", seedDemo);
router.get("/me", optionalAuth, requireAuth, me);
router.patch("/me", optionalAuth, requireAuth, updateMe);
router.get("/users", optionalAuth, requireAuth, requireRole("super_admin", "department_head"), listUsers);
router.post("/users", optionalAuth, requireAuth, requireRole("super_admin"), createUser);
router.patch("/users/:id", optionalAuth, requireAuth, requireRole("super_admin", "department_head"), updateUser);
router.delete("/users/:id", optionalAuth, requireAuth, requireRole("super_admin"), deleteUser);

export default router;
