import User from "../models/User.js";
import Department from "../models/Department.js";
import Program from "../models/Program.js";
import Course from "../models/Course.js";
import { hashPassword, signToken } from "../utils/authUtils.js";

/** Örnek test kullanıcıları (panelleri denemek için) */
const DEMO_USERS = [
  { email: "admin@test.com", password: "Test123!", name: "Süper Admin", role: "super_admin" },
  { email: "bolum@test.com", password: "Test123!", name: "Bölüm Başkanı", role: "department_head" },
  { email: "ogretmen@test.com", password: "Test123!", name: "Öğretmen", role: "teacher" },
];

/**
 * POST /api/auth/seed-demo
 * Body: { secret } - INIT_ADMIN_SECRET ile. Örnek admin, bölüm başkanı ve öğretmen oluşturur.
 */
export async function seedDemo(req, res) {
  try {
    const { secret } = req.body || {};
    const initSecret = process.env.INIT_ADMIN_SECRET;
    if (!initSecret || secret !== initSecret) {
      return res.status(403).json({
        success: false,
        message: "Yetkisiz. secret gerekli.",
      });
    }
    const firstDept = await Department.findOne().select("_id").lean();
    const created = [];
    for (const u of DEMO_USERS) {
      let existing = await User.findOne({ email: u.email.toLowerCase() });
      if (existing) {
        existing.passwordHash = await hashPassword(u.password);
        existing.name = u.name;
        existing.role = u.role;
        if (u.role === "department_head" && firstDept) existing.departmentId = firstDept._id;
        if (u.role !== "teacher") {
          existing.assignedCourseIds = [];
          existing.assignedProgramIds = [];
        }
        await existing.save();
        created.push({ email: u.email, role: u.role, updated: true });
      } else {
        const passwordHash = await hashPassword(u.password);
        const doc = {
          email: u.email.toLowerCase(),
          passwordHash,
          name: u.name,
          role: u.role,
          departmentId: u.role === "department_head" && firstDept ? firstDept._id : null,
          assignedProgramIds: u.role === "teacher" ? [] : [],
          assignedCourseIds: u.role === "teacher" ? [] : [],
        };
        await User.create(doc);
        created.push({ email: u.email, role: u.role });
      }
    }
    return res.status(200).json({
      success: true,
      message: "Demo kullanıcılar hazır.",
      data: {
        users: created,
        hint: "admin@test.com / bolum@test.com / ogretmen@test.com — şifre: Test123!",
      },
    });
  } catch (error) {
    console.error("seedDemo error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Demo kullanıcılar oluşturulamadı.",
    });
  }
}

/**
 * POST /api/auth/seed-admin
 * Body: { secret, email, password, name? }
 * Sadece INIT_ADMIN_SECRET doğru ve (henüz kullanıcı yok veya sadece bu işlem için) bir kez süper admin oluşturur.
 */
export async function seedAdmin(req, res) {
  try {
    const { secret, email, password, name } = req.body;
    const initSecret = process.env.INIT_ADMIN_SECRET;
    if (!initSecret || secret !== initSecret) {
      return res.status(403).json({
        success: false,
        message: "Yetkisiz.",
      });
    }
    if (!email?.trim() || !password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "E-posta ve en az 6 karakter şifre gerekli.",
      });
    }
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Bu e-posta zaten kayıtlı.",
      });
    }
    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email: email.trim().toLowerCase(),
      passwordHash,
      name: name || null,
      role: "super_admin",
    });
    return res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("seedAdmin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Oluşturulamadı.",
    });
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { _id, email, name, role, departmentId, assignedCourseIds } }
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "E-posta ve şifre gereklidir.",
      });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "E-posta veya şifre hatalı.",
      });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "E-posta veya şifre hatalı.",
      });
    }
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const token = signToken(payload);
    const userResponse = {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      assignedProgramIds: user.assignedProgramIds || [],
      assignedCourseIds: user.assignedCourseIds || [],
    };
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Giriş yapılamadı.",
    });
  }
}

/**
 * POST /api/auth/users - Sadece super_admin. Yeni kullanıcı oluşturur.
 * Body: { email, password, name?, role, departmentId?, assignedProgramIds?, assignedCourseIds? }
 */
export async function createUser(req, res) {
  try {
    const { email, password, name, role, departmentId, assignedProgramIds, assignedCourseIds } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: "E-posta gereklidir." });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Şifre en az 6 karakter olmalıdır." });
    }
    const validRoles = ["super_admin", "department_head", "teacher"];
    const roleValue = validRoles.includes(role) ? role : "teacher";

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Bu e-posta zaten kayıtlı." });
    }

    const passwordHash = await hashPassword(String(password));
    const doc = {
      email: email.trim().toLowerCase(),
      passwordHash,
      name: name?.trim() || null,
      role: roleValue,
      departmentId: departmentId || null,
      assignedProgramIds: Array.isArray(assignedProgramIds) ? assignedProgramIds : [],
      assignedCourseIds: Array.isArray(assignedCourseIds) ? assignedCourseIds : [],
    };
    const user = await User.create(doc);
    const created = await User.findById(user._id)
      .select("-passwordHash")
      .populate("departmentId", "name code")
      .populate("assignedProgramIds", "name code")
      .populate("assignedCourseIds", "name code")
      .lean();
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("createUser error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Kullanıcı oluşturulamadı.",
    });
  }
}

/**
 * GET /api/auth/users
 * - Süper admin: tüm kullanıcılar
 * - Bölüm başkanı: kendi bölümündeki öğretmenler (departmentId veya atanmış programları bölüme ait olanlar)
 */
export async function listUsers(req, res) {
  try {
    let filter = {};
    if (req.user?.role === "department_head" && req.user.departmentId) {
      const deptId = req.user.departmentId;
      const programIds = await Program.find({ department: deptId }).distinct("_id");
      filter = {
        role: "teacher",
        $or: [
          { departmentId: deptId },
          ...(programIds.length ? [{ assignedProgramIds: { $in: programIds } }] : []),
        ],
      };
    }
    const users = await User.find(filter)
      .select("-passwordHash")
      .populate("departmentId", "name code")
      .populate("assignedProgramIds", "name code")
      .populate("assignedCourseIds", "name code")
      .lean();
    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("listUsers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Kullanıcılar listelenemedi",
    });
  }
}

/**
 * Bölüm başkanının güncelleyebileceği kullanıcılar: kendi bölümündeki öğretmenler.
 */
async function isTeacherInDepartment(userId, departmentId) {
  const programIds = await Program.find({ department: departmentId }).distinct("_id");
  const u = await User.findById(userId).select("role departmentId assignedProgramIds").lean();
  if (!u || u.role !== "teacher") return false;
  if (u.departmentId && u.departmentId.toString() === departmentId.toString()) return true;
  if (programIds.length && u.assignedProgramIds?.some((p) => programIds.some((id) => id.toString() === (p?._id ?? p).toString()))) return true;
  return false;
}

/**
 * PATCH /api/auth/users/:id
 * - Süper admin: tüm alanları güncelleyebilir.
 * - Bölüm başkanı: sadece kendi bölümündeki öğretmenlerin assignedProgramIds ve assignedCourseIds (bölüme ait program/dersler ile).
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, role, departmentId, assignedProgramIds, assignedCourseIds } = req.body;
    const user = await User.findById(id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    const isDeptHead = req.user?.role === "department_head";
    const deptId = req.user?.departmentId;

    if (isDeptHead && deptId) {
      const allowed = await isTeacherInDepartment(id, deptId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: "Bu kullanıcıyı güncelleme yetkiniz yok." });
      }
      const programIds = await Program.find({ department: deptId }).distinct("_id");
      const courseIds = await Course.find({ department: deptId }).distinct("_id");
      const safeProgramIds = Array.isArray(assignedProgramIds)
        ? assignedProgramIds.filter((p) => programIds.some((id) => id.toString() === String(p)))
        : (user.assignedProgramIds || []).map((p) => (p?._id ?? p)).filter((p) => programIds.some((id) => id.toString() === String(p)));
      const safeCourseIds = Array.isArray(assignedCourseIds)
        ? assignedCourseIds.filter((c) => courseIds.some((id) => id.toString() === String(c)))
        : (user.assignedCourseIds || []).map((c) => (c?._id ?? c)).filter((c) => courseIds.some((id) => id.toString() === String(c)));
      const updated = await User.findByIdAndUpdate(
        id,
        { $set: { assignedProgramIds: safeProgramIds, assignedCourseIds: safeCourseIds } },
        { new: true }
      )
        .select("-passwordHash")
        .populate("departmentId", "name code")
        .populate("assignedProgramIds", "name code")
        .populate("assignedCourseIds", "name code")
        .lean();
      return res.status(200).json({ success: true, data: updated });
    }

    const update = {};
    if (name !== undefined) update.name = String(name).trim() || null;
    if (email !== undefined) {
      const newEmail = String(email).trim().toLowerCase();
      if (!newEmail) return res.status(400).json({ success: false, message: "E-posta boş olamaz." });
      const existing = await User.findOne({ email: newEmail, _id: { $ne: id } });
      if (existing) return res.status(400).json({ success: false, message: "Bu e-posta başka bir kullanıcıda kayıtlı." });
      update.email = newEmail;
    }
    if (role !== undefined && ["super_admin", "department_head", "teacher"].includes(role)) {
      update.role = role;
    }
    if (departmentId !== undefined) {
      update.departmentId = departmentId || null;
    }
    if (assignedProgramIds !== undefined) {
      update.assignedProgramIds = Array.isArray(assignedProgramIds) ? assignedProgramIds : [];
    }
    if (assignedCourseIds !== undefined) {
      update.assignedCourseIds = Array.isArray(assignedCourseIds) ? assignedCourseIds : [];
    }
    const updated = await User.findByIdAndUpdate(id, { $set: update }, { new: true })
      .select("-passwordHash")
      .populate("departmentId", "name code")
      .populate("assignedProgramIds", "name code")
      .populate("assignedCourseIds", "name code")
      .lean();
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("updateUser error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Kullanıcı güncellenemedi.",
    });
  }
}

/**
 * DELETE /api/auth/users/:id - Sadece super_admin. Kendi hesabını silemez.
 */
export async function deleteUser(req, res) {
  try {
    if (req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Sadece süper admin kullanıcı silebilir." });
    }
    const { id } = req.params;
    if (req.user._id.toString() === id) {
      return res.status(400).json({ success: false, message: "Kendi hesabınızı silemezsiniz." });
    }
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    }
    return res.status(200).json({ success: true, message: "Kullanıcı silindi." });
  } catch (error) {
    console.error("deleteUser error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Kullanıcı silinemedi.",
    });
  }
}

/**
 * GET /api/auth/me - Requires auth. Returns current user (department ve atanmış dersler populate).
 */
export async function me(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Oturum açmanız gerekiyor.",
      });
    }
    const user = await User.findById(req.user._id)
      .select("-passwordHash")
      .populate({
        path: "departmentId",
        select: "name code",
        populate: { path: "programs", select: "name code" },
      })
      .populate({
        path: "assignedProgramIds",
        select: "name code department",
        populate: { path: "department", select: "name code" },
      })
      .populate({
        path: "assignedCourseIds",
        select: "name code program department",
        populate: [
          { path: "program", select: "name code" },
          { path: "department", select: "name code" },
        ],
      })
      .lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    }
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Kullanıcı bilgisi alınamadı.",
    });
  }
}

/**
 * PATCH /api/auth/me - Kendi profilini güncelle: name, email, password (opsiyonel).
 */
export async function updateMe(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Oturum açmanız gerekiyor.",
      });
    }
    const { name, email, password } = req.body;
    const update = {};
    if (name !== undefined) update.name = String(name).trim() || null;
    if (email !== undefined) {
      const newEmail = String(email).trim().toLowerCase();
      if (!newEmail) {
        return res.status(400).json({ success: false, message: "E-posta boş olamaz." });
      }
      const existing = await User.findOne({ email: newEmail, _id: { $ne: req.user._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: "Bu e-posta başka bir kullanıcıda kayıtlı." });
      }
      update.email = newEmail;
    }
    if (password !== undefined && password !== "") {
      if (String(password).length < 6) {
        return res.status(400).json({ success: false, message: "Şifre en az 6 karakter olmalı." });
      }
      update.passwordHash = await hashPassword(password);
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true }
    )
      .select("-passwordHash")
      .populate("departmentId", "name code")
      .populate("assignedProgramIds", "name code")
      .populate("assignedCourseIds", "name code")
      .lean();
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("updateMe error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Profil güncellenemedi.",
    });
  }
}
