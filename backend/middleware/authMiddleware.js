import User from "../models/User.js";
import { verifyToken } from "../utils/authUtils.js";

/**
 * Optional auth: decode JWT if present and set req.user. No 401.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    req.user = null;
    return next();
  }
  try {
    const user = await User.findById(decoded.userId)
      .select("email name role departmentId assignedCourseIds")
      .lean();
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Require auth: 401 if no valid user.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Oturum açmanız gerekiyor.",
    });
  }
  next();
}

/**
 * Require one of the given roles. Call after optionalAuth/requireAuth.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Oturum açmanız gerekiyor.",
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için yetkiniz yok.",
      });
    }
    next();
  };
}

/**
 * Ders listesi için filtre: role göre hangi dersler görünsün.
 * @param {object|null} user - req.user (lean)
 * @returns {object} Mongoose Course find filter
 */
export function getCourseFilterForUser(user) {
  if (!user) return {};
  if (user.role === "super_admin") return {};
  if (user.role === "department_head" && user.departmentId) {
    return { department: user.departmentId };
  }
  if (user.role === "teacher") {
    const raw = user.assignedCourseIds || [];
    const ids = raw.map((c) => (c && typeof c === "object" && c._id ? c._id : c)).filter(Boolean);
    const instructorId = user._id;
    if (ids.length === 0 && !instructorId) return { _id: null };
    if (ids.length === 0) return { instructorId };
    return {
      $or: [
        { _id: { $in: ids } },
        { instructorId },
      ],
    };
  }
  return {};
}
