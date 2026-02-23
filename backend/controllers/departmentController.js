import Department from "../models/Department.js";
import Program from "../models/Program.js";
import Course from "../models/Course.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get all departments with programs
export const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate("programs", "code name nameEn")
      .sort({ name: 1 });
    return res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Bölümler getirilirken bir hata oluştu.",
    });
  }
};

// Create department
export const createDepartment = async (req, res) => {
  try {
    const { code, name, nameEn } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bölüm adı zorunludur.",
      });
    }
    const existing = await Department.findOne({
      $or: [
        { name: name.trim() },
        ...(code && code.trim() ? [{ code: code.trim() }] : []),
      ],
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Bu ad veya kodla bölüm zaten var.",
      });
    }
    const department = new Department({
      code: code?.trim() || undefined,
      name: name.trim(),
      nameEn: nameEn?.trim(),
    });
    await department.save();
    const populated = await Department.findById(department._id).populate("programs", "code name nameEn");
    return res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    console.error("Error creating department:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Bölüm oluşturulurken hata oluştu.",
    });
  }
};

// Update department
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, nameEn } = req.body;
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Bölüm bulunamadı.",
      });
    }
    if (name !== undefined && name.trim()) department.name = name.trim();
    if (code !== undefined) department.code = code?.trim() || undefined;
    if (nameEn !== undefined) department.nameEn = nameEn?.trim() || undefined;
    await department.save();
    const populated = await Department.findById(department._id).populate("programs", "code name nameEn");
    return res.status(200).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    console.error("Error updating department:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Bölüm güncellenirken hata oluştu.",
    });
  }
};

// Delete department
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Bölüm bulunamadı.",
      });
    }
    await Program.deleteMany({ department: id });
    await Course.updateMany(
      { department: id },
      { $unset: { department: "", program: "" } }
    );
    await Department.findByIdAndDelete(id);
    return res.status(200).json({
      success: true,
      message: "Bölüm silindi.",
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Bölüm silinirken hata oluştu.",
    });
  }
};

// Seed departments and programs (clears existing and recreates from JSON)
export const seedDepartments = async (req, res) => {
  try {
    // Read seed data
    const seedDataPath = join(__dirname, "../data/departments.json");
    const seedData = JSON.parse(readFileSync(seedDataPath, "utf-8"));

    // Get all existing department IDs before deletion
    const existingDepartments = await Department.find({});
    const existingDepartmentIds = existingDepartments.map(dept => dept._id);

    // Delete all existing programs first (to avoid orphaned references)
    await Program.deleteMany({});

    // Update courses to remove department and program references
    if (existingDepartmentIds.length > 0) {
      await Course.updateMany(
        { department: { $in: existingDepartmentIds } },
        { $unset: { department: "", program: "" } }
      );
    }

    // Delete all existing departments
    await Department.deleteMany({});

    let totalDepartmentsAdded = 0;
    let totalProgramsAdded = 0;
    const results = [];

    // Process each department
    for (const deptData of seedData) {
      // Extract programs from department data
      const { programs, ...departmentFields } = deptData;

      // Create new department (we already deleted all, so this will always be new)
      const department = new Department(departmentFields);
      await department.save();
      totalDepartmentsAdded++;

      // Process programs for this department
      const programIds = [];
      if (programs && Array.isArray(programs)) {
        for (const programData of programs) {
          // Create new program
          const program = new Program({
            ...programData,
            department: department._id,
          });
          await program.save();
          totalProgramsAdded++;
          programIds.push(program._id);
        }
      }

      // Update department with program references
      if (programIds.length > 0) {
        department.programs = programIds;
        await department.save();
      }

      // Populate programs for response
      const departmentWithPrograms = await Department.findById(department._id)
        .populate("programs", "code name nameEn");
      results.push(departmentWithPrograms);
    }

    // Final populate all results
    const finalResults = await Department.find()
      .populate("programs", "code name nameEn")
      .sort({ name: 1 });

    return res.status(201).json({
      success: true,
      message: `${totalDepartmentsAdded} bölüm ve ${totalProgramsAdded} program başarıyla oluşturuldu. Tüm eski bölümler ve programlar silindi.`,
      data: finalResults,
    });
  } catch (error) {
    console.error("Error seeding departments:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Bölümler eklenirken bir hata oluştu.",
    });
  }
};

