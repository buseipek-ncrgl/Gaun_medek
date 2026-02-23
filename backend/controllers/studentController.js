import Student from "../models/Student.js";
import Score from "../models/Score.js";
import { createNotification } from "./notificationController.js";
import { getCourseFilterForUser } from "../middleware/authMiddleware.js";

/** Türkçe karakter mojibake düzeltmesi: yanlış encoding ile kaydedilmiş metni düzeltir. Zaten doğru UTF-8 Türkçe içeren metne dokunmaz. */
function fixTurkishEncoding(str) {
  if (!str || typeof str !== "string") return str;
  try {
    const hasValidTurkish = /[çğıöşüÇĞİÖŞÜ]/.test(str);
    if (!hasValidTurkish) {
      const decoded = Buffer.from(str, "latin1").toString("utf8");
      if (decoded !== str && !decoded.includes("\uFFFD")) str = decoded;
    }
  } catch (_) {}
  // Excel/yanlış kayıt mojibake: harf arası 1→ı, _e→ş (örn. Y1ld1z→Yıldız, Ay_e→Ayşe)
  str = str.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])1([a-zA-ZçğıöşüÇĞİÖŞÜ])/g, "$1ı$2");
  str = str.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])_e([a-zA-ZçğıöşüÇĞİÖŞÜ\s])/g, "$1ş$2");
  str = str.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])_u([a-zA-ZçğıöşüÇĞİÖŞÜ\s])/g, "$1ü$2");
  str = str.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])_o([a-zA-ZçğıöşüÇĞİÖŞÜ\s])/g, "$1ö$2");
  str = str.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])_c([a-zA-ZçğıöşüÇĞİÖŞÜ\s])/g, "$1ç$2");
  str = str.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])_g([a-zA-ZçğıöşüÇĞİÖŞÜ\s])/g, "$1ğ$2");
  str = str.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])_i([a-zA-ZçğıöşüÇĞİÖŞÜ\s])/g, "$1ı$2");
  return str;
}

// Create a new Student
const createStudent = async (req, res) => {
  try {
    const { studentNumber, name, department, classLevel } = req.body;
    const Department = (await import("../models/Department.js")).default;

    // Validate required fields
    if (!studentNumber || !name) {
      return res.status(400).json({
        success: false,
        message: "studentNumber and name are required",
      });
    }

    // Validate uniqueness of studentNumber
    const existingStudent = await Student.findOne({ studentNumber });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Bu öğrenci numarası zaten kayıtlı. Farklı bir numara girin.",
      });
    }

    // Convert department name to ID if it's a name
    let departmentId = department;
    if (department && typeof department === 'string') {
      const mongoose = (await import("mongoose")).default;
      // Check if it's already an ObjectId
      if (!mongoose.Types.ObjectId.isValid(department)) {
        // It's a name, find the department by name
        const dept = await Department.findOne({ name: department });
        if (dept) {
          departmentId = dept._id.toString();
        } else {
          // If department not found, keep as name (for backward compatibility)
          departmentId = department;
        }
      }
    }

    const student = new Student({
      studentNumber,
      name,
      department: departmentId,
      classLevel,
    });

    const savedStudent = await student.save();

    // Create notification for new student
    try {
      await createNotification({
        type: "student_added",
        title: "Yeni Öğrenci Eklendi",
        message: `${name} (${studentNumber}) sisteme eklendi.`,
        link: `/students/${savedStudent._id}`,
        metadata: {
          studentId: savedStudent._id.toString(),
          studentNumber,
          name,
        },
      });
    } catch (notifError) {
      console.error("Failed to create student notification:", notifError);
    }

    const studentObj = savedStudent.toObject();
    if (studentObj.name) studentObj.name = fixTurkishEncoding(studentObj.name);
    if (studentObj.department) {
      try {
        const mongoose = (await import("mongoose")).default;
        if (mongoose.Types.ObjectId.isValid(studentObj.department)) {
          const dept = await Department.findById(studentObj.department);
          if (dept) {
            studentObj.department = dept.name;
          }
        }
      } catch (err) {
        // Keep as is if lookup fails
      }
    }

    return res.status(201).json({
      success: true,
      data: studentObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Rol bazlı öğrenci filtresi: bölüm başkanı kendi bölümü, öğretmen atanmış derslerdeki öğrenciler
function getStudentFilterForUser(user) {
  if (!user) return {};
  if (user.role === "super_admin") return {};
  if (user.role === "department_head" && user.departmentId) {
    const deptId = user.departmentId._id || user.departmentId;
    const idStr = deptId && (typeof deptId === "string" ? deptId : deptId.toString?.());
    if (idStr) return { department: idStr };
    return {};
  }
  if (user.role === "teacher") {
    return { __teacherFilter: getCourseFilterForUser(user) };
  }
  return {};
}

// Get all Students (rol varsa: süper admin tümü, bölüm başkanı kendi bölümü, öğretmen atanmış derslerdeki öğrenciler)
const getStudents = async (req, res) => {
  try {
    const Department = (await import("../models/Department.js")).default;
    const Course = (await import("../models/Course.js")).default;
    const mongoose = (await import("mongoose")).default;

    let query = {};
    const filter = getStudentFilterForUser(req.user || null);
    if (filter.__teacherFilter) {
      const courseFilter = filter.__teacherFilter;
      const courses = await Course.find(courseFilter).select("students").lean();
      const studentNumbers = new Set();
      courses.forEach((c) => {
        (c.students || []).forEach((s) => {
          if (s && s.studentNumber) studentNumbers.add(String(s.studentNumber).trim());
        });
      });
      if (studentNumbers.size === 0) {
        query = { _id: null };
      } else {
        query = { studentNumber: { $in: Array.from(studentNumbers) } };
      }
    } else if (Object.keys(filter).length > 0 && !filter.__teacherFilter) {
      query = filter;
    }

    const students = await Student.find(query).sort({ studentNumber: 1 });

    // Transform department ID to name; Türkçe karakter düzeltmesi
    const transformedStudents = await Promise.all(
      students.map(async (student) => {
        const studentObj = student.toObject();
        if (studentObj.name) studentObj.name = fixTurkishEncoding(studentObj.name);
        if (studentObj.department) {
          try {
            const mongoose = (await import("mongoose")).default;
            if (mongoose.Types.ObjectId.isValid(studentObj.department)) {
              const dept = await Department.findById(studentObj.department);
              if (dept) {
                studentObj.department = dept.name;
              }
            }
          } catch (err) {
            console.log("Department lookup failed, keeping as string:", err.message);
          }
        }
        return studentObj;
      })
    );

    return res.status(200).json({
      success: true,
      data: transformedStudents,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get a single Student by ID
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const Department = (await import("../models/Department.js")).default;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const studentObj = student.toObject();
    if (studentObj.name) studentObj.name = fixTurkishEncoding(studentObj.name);
    if (studentObj.department) {
      try {
        // Check if department is an ObjectId string
        const mongoose = (await import("mongoose")).default;
        if (mongoose.Types.ObjectId.isValid(studentObj.department)) {
          const dept = await Department.findById(studentObj.department);
          if (dept) {
            studentObj.department = dept.name;
          }
        }
      } catch (err) {
        // If department is already a string, keep it as is
        console.log("Department lookup failed, keeping as string:", err.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: studentObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get a single Student by studentNumber
const getStudentByNumber = async (req, res) => {
  try {
    const { studentNumber } = req.params;
    const Department = (await import("../models/Department.js")).default;

    const student = await Student.findOne({ studentNumber });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const studentObj = student.toObject();
    if (studentObj.name) studentObj.name = fixTurkishEncoding(studentObj.name);
    if (studentObj.department) {
      try {
        // Check if department is an ObjectId string
        const mongoose = (await import("mongoose")).default;
        if (mongoose.Types.ObjectId.isValid(studentObj.department)) {
          const dept = await Department.findById(studentObj.department);
          if (dept) {
            studentObj.department = dept.name;
          }
        }
      } catch (err) {
        // If department is already a string, keep it as is
        console.log("Department lookup failed, keeping as string:", err.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: studentObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update a Student
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const name = body.name !== undefined ? body.name : (body.data && body.data.name);
    const department = body.department !== undefined ? body.department : (body.data && body.data.department);
    const classLevel = body.classLevel !== undefined ? body.classLevel : (body.data && body.data.classLevel);

    // Check if Student exists
    const existingStudent = await Student.findById(id);
    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Do NOT allow studentNumber to change
    if (body.studentNumber || (body.data && body.data.studentNumber)) {
      return res.status(400).json({
        success: false,
        message: "Student number cannot be changed",
      });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined && name !== null) {
      // İstemci zaten UTF-8 gönderiyor; fixTurkishEncoding sadece mojibake için, kayıtta uygulama (bozulmayı önler)
      updateData.name = String(name).trim();
    }
    if (classLevel !== undefined && classLevel !== null) {
      const level = Number(classLevel);
      if (!Number.isNaN(level)) updateData.classLevel = level;
    }
    if (department !== undefined) {
      const Department = (await import("../models/Department.js")).default;
      if (department && typeof department === 'string') {
        const mongoose = (await import("mongoose")).default;
        // Check if it's already an ObjectId
        if (!mongoose.Types.ObjectId.isValid(department)) {
          // It's a name, find the department by name
          const dept = await Department.findOne({ name: department });
          if (dept) {
            updateData.department = dept._id.toString();
          } else {
            // If department not found, keep as name (for backward compatibility)
            updateData.department = department;
          }
        } else {
          updateData.department = department;
        }
      } else {
        updateData.department = department;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Güncellenecek alan yok. name, department veya classLevel gönderin.",
      });
    }

    const doc = await Student.findById(id);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }
    if (updateData.name !== undefined) doc.name = updateData.name;
    if (updateData.classLevel !== undefined) doc.classLevel = updateData.classLevel;
    if (updateData.department !== undefined) doc.department = updateData.department;
    await doc.save();

    const updatedStudent = await Student.findById(id).lean();
    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found after update",
      });
    }

    const studentObj = { ...updatedStudent };
    if (studentObj.name) studentObj.name = fixTurkishEncoding(studentObj.name);
    if (studentObj.department) {
      try {
        const mongoose = (await import("mongoose")).default;
        if (mongoose.Types.ObjectId.isValid(studentObj.department)) {
          const Department = (await import("../models/Department.js")).default;
          const dept = await Department.findById(studentObj.department);
          if (dept) {
            studentObj.department = dept.name;
          }
        }
      } catch (err) {
        // Keep as is if lookup fails
      }
    }

    return res.status(200).json({
      success: true,
      data: studentObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete a Student
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if Student exists
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Check if student has any Score entries
    const hasScores = await Score.exists({ studentId: id });
    if (hasScores) {
      return res.status(400).json({
        success: false,
        message: "Student cannot be deleted because score records exist.",
      });
    }

    // Delete the student
    const deletedStudent = await Student.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
      data: deletedStudent,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export {
  createStudent,
  getStudents,
  getStudentById,
  getStudentByNumber,
  updateStudent,
  deleteStudent,
};

