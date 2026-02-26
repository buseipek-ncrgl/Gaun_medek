import Course from "../models/Course.js";
import Department from "../models/Department.js";
import Program from "../models/Program.js";
import LearningOutcome from "../models/LearningOutcome.js";
import ProgramOutcome from "../models/ProgramOutcome.js";
import Exam from "../models/Exam.js";
import Student from "../models/Student.js";
import Question from "../models/Question.js";
import { getCourseFilterForUser } from "../middleware/authMiddleware.js";

// Create a new Course
const createCourse = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      departmentId,
      programId,
      semester,
      learningOutcomes, // ÖÇ listesi (zorunlu)
      midtermExam,
      finalExam,
      students,
      reportPassingThreshold,
    } = req.body;

    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Ders adı ve kodu gereklidir.",
      });
    }

    // Validate departmentId
    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: "Lütfen bir bölüm seçin.",
      });
    }

    // Validate department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(400).json({
        success: false,
        message: "Seçilen bölüm bulunamadı.",
      });
    }

    // Validate program if provided
    if (programId) {
      const program = await Program.findById(programId);
      if (!program) {
        return res.status(400).json({
          success: false,
          message: "Seçilen program bulunamadı.",
        });
      }
      // Validate program belongs to the selected department
      if (program.department.toString() !== departmentId) {
        return res.status(400).json({
          success: false,
          message: "Seçilen program, seçilen bölüme ait değil.",
        });
      }
    }

    if (!Array.isArray(learningOutcomes) || learningOutcomes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "En az bir öğrenme çıktısı (ÖÇ) eklemelisiniz.",
      });
    }

    if (!midtermExam || !midtermExam.examCode) {
      return res.status(400).json({
        success: false,
        message: "Vize sınav ayarları gereklidir.",
      });
    }

    if (!finalExam || !finalExam.examCode) {
      return res.status(400).json({
        success: false,
        message: "Final sınav ayarları gereklidir.",
      });
    }

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "En az bir öğrenci eklemelisiniz.",
      });
    }

    // Validate that the course code is unique
    const normalizedCode = code.trim().toUpperCase();
    const existingCourse = await Course.findOne({ code: normalizedCode });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: `"${normalizedCode}" ders kodu zaten mevcut. Lütfen farklı bir ders kodu kullanın veya mevcut dersi düzenleyin.`,
      });
    }

    // PÇ listesini oluştur (istekten veya ÖÇ -> PÇ eşleşmesinden)
    const invalidLO = learningOutcomes.find(
      (lo) => !lo || !lo.code || !lo.description
    );
    if (invalidLO) {
      return res.status(400).json({
        success: false,
        message: "Her öğrenme çıktısı için kod ve açıklama gereklidir.",
      });
    }

    const user = req.user || {};
    const isTeacher = user.role === "teacher";

    // Create course with ALL fields (PÇ geçici olarak devre dışı)
    const courseData = {
      name: name.trim(),
      code: normalizedCode,
      description: description?.trim() || "",
      department: departmentId,
      program: programId && programId.trim() !== "" ? programId : undefined,
      semester: semester.trim(),
      learningOutcomes: learningOutcomes || [],
      midtermExam: {
        examCode: midtermExam.examCode,
        questionCount: midtermExam.questionCount,
        maxScorePerQuestion: midtermExam.maxScorePerQuestion,
        questionMaxScores: Array.isArray(midtermExam.questionMaxScores) ? midtermExam.questionMaxScores : undefined,
      },
      finalExam: {
        examCode: finalExam.examCode,
        questionCount: finalExam.questionCount,
        maxScorePerQuestion: finalExam.maxScorePerQuestion,
        questionMaxScores: Array.isArray(finalExam.questionMaxScores) ? finalExam.questionMaxScores : undefined,
      },
      reportPassingThreshold: reportPassingThreshold != null && reportPassingThreshold !== "" ? Math.min(100, Math.max(0, Number(reportPassingThreshold))) : null,
      students: students || [],
    };
    if (isTeacher && user._id) courseData.instructorId = user._id;

    const course = new Course(courseData);
    const savedCourse = await course.save();

    // Create LearningOutcome documents (legacy collection) and link them
    const learningOutcomeIds = [];
    if (learningOutcomes && Array.isArray(learningOutcomes) && learningOutcomes.length > 0) {
      for (const outcome of learningOutcomes) {
        if (outcome.code && outcome.description) {
          const learningOutcome = new LearningOutcome({
            courseId: savedCourse._id,
            code: outcome.code,
            description: outcome.description,
          });
          const savedOutcome = await learningOutcome.save();
          learningOutcomeIds.push(savedOutcome._id);
        }
      }
    }

    // Create Midterm Exam document (MEDEK uyumlu yeni yapı)
    let midtermExamId = null;
    if (midtermExam && midtermExam.examCode) {
      // İlk ÖÇ'yi varsayılan olarak kullan (sorular daha sonra exam creation'da eşlenecek)
      const defaultLO = learningOutcomes[0]?.code || "ÖÇ1";
      
      const midtermQuestions = [];
      for (let i = 1; i <= midtermExam.questionCount; i++) {
        midtermQuestions.push({
          questionNumber: i,
          learningOutcomeCode: defaultLO, // Varsayılan, sonra exam creation'da güncellenecek
        });
      }

      const midterm = new Exam({
        courseId: savedCourse._id,
        examType: "midterm",
        examCode: midtermExam.examCode.trim(),
        questionCount: Number(midtermExam.questionCount),
        maxScorePerQuestion: Number(midtermExam.maxScorePerQuestion),
        questions: midtermQuestions,
      });
      const savedMidterm = await midterm.save();
      midtermExamId = savedMidterm._id;
    }

    // Create Final Exam document (MEDEK uyumlu yeni yapı)
    let finalExamId = null;
    if (finalExam && finalExam.examCode) {
      // İlk ÖÇ'yi varsayılan olarak kullan (sorular daha sonra exam creation'da eşlenecek)
      const defaultLO = learningOutcomes[0]?.code || "ÖÇ1";
      
      const finalQuestions = [];
      for (let i = 1; i <= finalExam.questionCount; i++) {
        finalQuestions.push({
          questionNumber: i,
          learningOutcomeCode: defaultLO, // Varsayılan, sonra exam creation'da güncellenecek
        });
      }

      const final = new Exam({
        courseId: savedCourse._id,
        examType: "final",
        examCode: finalExam.examCode.trim(),
        questionCount: Number(finalExam.questionCount),
        maxScorePerQuestion: Number(finalExam.maxScorePerQuestion),
        questions: finalQuestions,
      });
      const savedFinal = await final.save();
      finalExamId = savedFinal._id;
    }

    // Create or link Students
    const studentIds = [];
    if (students && Array.isArray(students) && students.length > 0) {
      for (const studentData of students) {
        if (studentData.studentNumber && studentData.fullName) {
          let student = await Student.findOne({
            studentNumber: studentData.studentNumber,
          });

          if (!student) {
            student = new Student({
              studentNumber: studentData.studentNumber,
              name: studentData.fullName,
              department: departmentId || undefined,
            });
            student = await student.save();
          }

          studentIds.push(student._id);
        }
      }
    }

    // Populate before returning
    const populatedCourse = await Course.findById(savedCourse._id)
      .populate("department", "name code")
      .populate("program", "code name nameEn")
      .exec();

    console.log("Create Course - Saved course with program:", populatedCourse.program); // Debug log

    return res.status(201).json({
      success: true,
      data: populatedCourse,
    });
  } catch (error) {
    console.error("Error creating course:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Ders oluşturulurken bir hata oluştu.",
    });
  }
};

// Get all Courses (rol varsa: süper admin tümü, bölüm başkanı kendi bölümü, öğretmen atanmış dersler)
const getCourses = async (req, res) => {
  try {
    const filter = getCourseFilterForUser(req.user || null);
    const courses = await Course.find(filter)
      .populate("department", "name code")
      .populate("program", "code name nameEn")
      .sort({ updatedAt: -1 });

    // Transform to include counts and exam codes
    const coursesWithDetails = courses.map((course) => {
      const courseObj = course.toObject();
      return {
        _id: courseObj._id,
        name: courseObj.name,
        code: courseObj.code,
        description: courseObj.description,
        department: courseObj.department || null,
        program: courseObj.program || null,
        semester: courseObj.semester,
        learningOutcomes: courseObj.learningOutcomes || [],
        learningOutcomesCount: courseObj.learningOutcomes?.length || 0,
        midtermExam: courseObj.midtermExam
          ? {
              examCode: courseObj.midtermExam.examCode,
              questionCount: courseObj.midtermExam.questionCount,
              maxScorePerQuestion: courseObj.midtermExam.maxScorePerQuestion,
              questionMaxScores: courseObj.midtermExam.questionMaxScores,
            }
          : null,
        finalExam: courseObj.finalExam
          ? {
              examCode: courseObj.finalExam.examCode,
              questionCount: courseObj.finalExam.questionCount,
              maxScorePerQuestion: courseObj.finalExam.maxScorePerQuestion,
              questionMaxScores: courseObj.finalExam.questionMaxScores,
            }
          : null,
        students: courseObj.students || [],
        studentsCount: courseObj.students?.length || 0,
        instructorId: courseObj.instructorId || null,
        createdAt: courseObj.createdAt,
        updatedAt: courseObj.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: coursesWithDetails,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Dersler getirilirken bir hata oluştu.",
    });
  }
};

// Get a single Course by ID (rol varsa sadece yetkili ders)
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id
    if (!id || id === 'undefined' || id === 'null' || id === '[object Object]') {
      return res.status(400).json({
        success: false,
        message: `Geçersiz ders ID: ${id}`,
      });
    }

    const course = await Course.findById(id)
      .populate("department", "name code")
      .populate("program", "code name nameEn")
      .exec();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Ders bulunamadı.",
      });
    }

    if (req.user) {
      const filter = { ...getCourseFilterForUser(req.user), _id: id };
      const allowed = await Course.findOne(filter).select("_id").lean();
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Bu derse erişim yetkiniz yok.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error('Error in getCourseById:', error);
    console.error("Error fetching course by ID:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Ders getirilirken bir hata oluştu.",
    });
  }
};

// Update a Course
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      description,
      departmentId,
      programId,
      semester,
      learningOutcomes, // Changed from "outcomes"
      midtermExam,
      finalExam,
      students,
      reportPassingThreshold,
    } = req.body;

    // Check if Course exists
    const existingCourse = await Course.findById(id);
    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: "Ders bulunamadı.",
      });
    }

    // Öğretmen: kendi eklediği (instructorId) veya admin/bölüm başkanının atadığı (assignedCourseIds) dersi düzenleyebilir
    const user = req.user;
    if (user?.role === "teacher") {
      const courseInstructorId = existingCourse.instructorId ? String(existingCourse.instructorId) : "";
      const isInstructor = courseInstructorId === String(user._id);
      const assignedIds = (user.assignedCourseIds || []).map((c) => (c && (c._id || c)).toString()).filter(Boolean);
      const isAssigned = assignedIds.includes(String(existingCourse._id));
      if (!isInstructor && !isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Bu dersi düzenleme yetkiniz yok. Sadece size atanan veya kendi eklediğiniz dersleri düzenleyebilirsiniz.",
        });
      }
    }

    // Validate unique code if changed
    if (code && code !== existingCourse.code) {
      const duplicateCourse = await Course.findOne({ code });
      if (duplicateCourse) {
        return res.status(400).json({
          success: false,
          message: "Bu ders kodu zaten mevcut.",
        });
      }
    }

    // Validate departmentId if provided
    if (departmentId !== undefined) {
      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(400).json({
          success: false,
          message: "Seçilen bölüm bulunamadı.",
        });
      }
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (departmentId !== undefined) updateData.department = departmentId;
    if (programId !== undefined) {
      updateData.program = programId || null; // Allow clearing program
    }
    if (semester !== undefined) updateData.semester = semester;
    if (reportPassingThreshold !== undefined) {
      const val = reportPassingThreshold === null || reportPassingThreshold === "" ? null : Math.min(100, Math.max(0, Number(reportPassingThreshold)));
      updateData.reportPassingThreshold = val;
    }

    // Handle learning outcomes
    if (learningOutcomes !== undefined) {
      updateData.learningOutcomes = learningOutcomes;
      // Also update LearningOutcome documents
      await LearningOutcome.deleteMany({ courseId: id });
      if (Array.isArray(learningOutcomes) && learningOutcomes.length > 0) {
        for (const outcome of learningOutcomes) {
          if (outcome.code && outcome.description) {
            const learningOutcome = new LearningOutcome({
              courseId: id,
              code: outcome.code,
              description: outcome.description,
            });
            await learningOutcome.save();
          }
        }
      }
    }

    // Handle midterm exam
    if (midtermExam !== undefined) {
      updateData.midtermExam = {
        examCode: midtermExam.examCode,
        questionCount: midtermExam.questionCount,
        maxScorePerQuestion: midtermExam.maxScorePerQuestion,
        questionMaxScores: Array.isArray(midtermExam.questionMaxScores) ? midtermExam.questionMaxScores : undefined,
      };
      // Update Exam document if exists
      const existingMidterm = await Exam.findOne({ courseId: id, type: "midterm" });
      if (existingMidterm) {
        existingMidterm.examCode = midtermExam.examCode;
        await existingMidterm.save();
        // Update questions
        await Question.deleteMany({ examId: existingMidterm._id });
        const learningOutcomeIds = await LearningOutcome.find({ courseId: id }).select("_id");
        if (learningOutcomeIds.length > 0) {
          for (let i = 1; i <= midtermExam.questionCount; i++) {
            const assignedLO = learningOutcomeIds[(i - 1) % learningOutcomeIds.length]._id;
            const question = new Question({
              examId: existingMidterm._id,
              number: i,
              maxScore: midtermExam.maxScorePerQuestion,
              mappedLearningOutcome: assignedLO,
            });
            await question.save();
          }
        }
      }
    }

    // Handle final exam
    if (finalExam !== undefined) {
      updateData.finalExam = {
        examCode: finalExam.examCode,
        questionCount: finalExam.questionCount,
        maxScorePerQuestion: finalExam.maxScorePerQuestion,
        questionMaxScores: Array.isArray(finalExam.questionMaxScores) ? finalExam.questionMaxScores : undefined,
      };
      // Update Exam document if exists
      const existingFinal = await Exam.findOne({ courseId: id, type: "final" });
      if (existingFinal) {
        existingFinal.examCode = finalExam.examCode;
        await existingFinal.save();
        // Update questions
        await Question.deleteMany({ examId: existingFinal._id });
        const learningOutcomeIds = await LearningOutcome.find({ courseId: id }).select("_id");
        if (learningOutcomeIds.length > 0) {
          for (let i = 1; i <= finalExam.questionCount; i++) {
            const assignedLO = learningOutcomeIds[(i - 1) % learningOutcomeIds.length]._id;
            const question = new Question({
              examId: existingFinal._id,
              number: i,
              maxScore: finalExam.maxScorePerQuestion,
              mappedLearningOutcome: assignedLO,
            });
            await question.save();
          }
        }
      }
    }

    // Handle students
    if (students !== undefined) {
      updateData.students = students;
      // Create or update Student documents
      const studentIds = [];
      for (const studentData of students) {
        if (studentData.studentNumber && studentData.fullName) {
          let student = await Student.findOne({
            studentNumber: studentData.studentNumber,
          });
          if (!student) {
            const courseDept = departmentId || existingCourse.department;
            student = new Student({
              studentNumber: studentData.studentNumber,
              name: studentData.fullName,
              department: courseDept,
            });
            student = await student.save();
          }
          studentIds.push(student._id);
        }
      }
    }

    // Validate program if provided
    if (updateData.program) {
      const program = await Program.findById(updateData.program);
      if (!program) {
        return res.status(400).json({
          success: false,
          message: "Seçilen program bulunamadı.",
        });
      }
      // Validate program belongs to the selected department
      const departmentId = updateData.department || course.department;
      if (program.department.toString() !== departmentId.toString()) {
        return res.status(400).json({
          success: false,
          message: "Seçilen program, seçilen bölüme ait değil.",
        });
      }
    }

    // Update course
    const updatedCourse = await Course.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("department", "name code")
      .populate("program", "code name nameEn")
      .exec();

    return res.status(200).json({
      success: true,
      data: updatedCourse,
    });
  } catch (error) {
    console.error("Error updating course:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Ders güncellenirken bir hata oluştu.",
    });
  }
};

// Delete a Course (super_admin: tümü, department_head: sadece kendi bölümündekiler)
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Ders bulunamadı.",
      });
    }

    // Öğretmen: kendi eklediği (instructorId) veya admin/bölüm başkanının atadığı (assignedCourseIds) dersi silebilir
    if (user?.role === "teacher") {
      const courseInstructorId = course.instructorId ? String(course.instructorId) : "";
      const isInstructor = courseInstructorId === String(user._id);
      const assignedIds = (user.assignedCourseIds || []).map((c) => (c && (c._id || c)).toString()).filter(Boolean);
      const isAssigned = assignedIds.includes(String(course._id));
      if (!isInstructor && !isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Bu dersi silme yetkiniz yok. Sadece size atanan veya kendi eklediğiniz dersleri silebilirsiniz.",
        });
      }
    }

    // Bölüm başkanı sadece kendi bölümündeki dersi silebilir
    if (user?.role === "department_head" && user.departmentId) {
      const courseDeptStr = course.department ? (typeof course.department === "object" && course.department.toString ? course.department.toString() : String(course.department)) : "";
      const userDeptStr = typeof user.departmentId === "object" && user.departmentId !== null ? (user.departmentId._id ? String(user.departmentId._id) : String(user.departmentId)) : String(user.departmentId || "");
      if (courseDeptStr !== userDeptStr) {
        return res.status(403).json({
          success: false,
          message: "Bu dersi silme yetkiniz yok. Sadece kendi bölümünüzdeki dersleri silebilirsiniz.",
        });
      }
    }

    // Delete associated Learning Outcomes
    await LearningOutcome.deleteMany({ courseId: id });

    // Delete associated Exams and Questions
    const exams = await Exam.find({ courseId: id });
    for (const exam of exams) {
      await Question.deleteMany({ examId: exam._id });
      await Exam.findByIdAndDelete(exam._id);
    }

    // Delete the course
    await Course.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Ders başarıyla silindi.",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Ders silinirken bir hata oluştu.",
    });
  }
};

// Get MEDEK LO→PO Matrix
const getCourseMatrix = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id)
      .populate("department", "programOutcomes")
      .exec();

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Ders bulunamadı.",
      });
    }

    const department = course.department;
    if (!department || !department.programOutcomes || department.programOutcomes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Bu ders için bölüm veya program çıktıları tanımlanmamış.",
      });
    }

    const learningOutcomes = course.learningOutcomes || [];
    if (learningOutcomes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Bu ders için öğrenme çıktısı tanımlanmamış.",
      });
    }

    // Get all PÇ codes from department
    const pcCodes = department.programOutcomes.map((po) => po.code);

    // Build matrix
    const rows = learningOutcomes.map((lo) => {
      const mapping = {};
      const loPCs = lo.programOutcomes || lo.relatedProgramOutcomes || [];

      pcCodes.forEach((pcCode) => {
        mapping[pcCode] = loPCs.includes(pcCode) ? 1 : 0;
      });

      return {
        ocCode: lo.code,
        ocDescription: lo.description,
        mapping,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        course: {
          _id: course._id,
          name: course.name,
          code: course.code,
        },
        department: {
          _id: department._id,
          name: department.name,
        },
        columns: pcCodes,
        rows,
      },
    });
  } catch (error) {
    console.error("Error generating matrix:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Matris oluşturulurken bir hata oluştu.",
    });
  }
};

// Seed courses (for development/testing - imports existing courses if any)
const seedCourses = async (req, res) => {
  try {
    // Check if courses already exist
    const existingCount = await Course.countDocuments();
    if (existingCount > 0) {
      // Return existing courses instead of error
      const existingCourses = await Course.find()
        .populate("department", "name code")
        .sort({ updatedAt: -1 });
      
      return res.status(200).json({
        success: true,
        message: `${existingCount} mevcut ders bulundu.`,
        data: existingCourses,
      });
    }

    // If no courses exist, you can add sample courses here
    // For now, just return empty array
    return res.status(200).json({
      success: true,
      message: "Henüz ders bulunmuyor. Yeni ders oluşturabilirsiniz.",
      data: [],
    });
  } catch (error) {
    console.error("Error seeding courses:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Dersler işlenirken bir hata oluştu.",
    });
  }
};

export {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getCourseMatrix,
  seedCourses,
};
