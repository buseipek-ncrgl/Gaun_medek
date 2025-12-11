import Student from "../models/Student.js";
import Score from "../models/Score.js";

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
        message: "Student with this student number already exists",
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
    
    // Veri kaydedildiğini doğrula
    if (!savedStudent || !savedStudent._id) {
      throw new Error("Öğrenci kaydedilemedi. Lütfen tekrar deneyin.");
    }
    console.log(`✅ Öğrenci kaydedildi: ${savedStudent.studentNumber} (ID: ${savedStudent._id})`);

    // Transform department ID to name for response
    const studentObj = savedStudent.toObject();
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

// Get all Students
const getStudents = async (req, res) => {
  try {
    const Department = (await import("../models/Department.js")).default;
    const students = await Student.find().sort({ studentNumber: 1 });

    // Transform department ID to name
    const transformedStudents = await Promise.all(
      students.map(async (student) => {
        const studentObj = student.toObject();
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

    // Transform department ID to name if it's an ObjectId
    const studentObj = student.toObject();
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

    // Transform department ID to name if it's an ObjectId
    const studentObj = student.toObject();
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
    const { name, department, classLevel } = req.body;

    // Check if Student exists
    const existingStudent = await Student.findById(id);
    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Do NOT allow studentNumber to change
    if (req.body.studentNumber) {
      return res.status(400).json({
        success: false,
        message: "Student number cannot be changed",
      });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (classLevel !== undefined) updateData.classLevel = classLevel;
    
    // Convert department name to ID if it's a name
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

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Transform department ID to name for response
    const Department = (await import("../models/Department.js")).default;
    const studentObj = updatedStudent.toObject();
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

