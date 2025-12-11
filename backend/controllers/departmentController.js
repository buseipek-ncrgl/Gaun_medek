import Department from "../models/Department.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get all departments
export const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
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

// Seed departments (idempotent - tekrar çalıştırılabilir)
export const seedDepartments = async (req, res) => {
  try {
    // Read seed data
    const seedDataPath = join(__dirname, "../data/departments.json");
    const seedData = JSON.parse(readFileSync(seedDataPath, "utf-8"));

    // Upsert each department (name'e göre unique, varsa güncelle yoksa ekle)
    const results = await Promise.all(
      seedData.map(async (dept) => {
        return await Department.findOneAndUpdate(
          { name: dept.name },
          { $setOnInsert: dept }, // Sadece yeni kayıt eklerken set et
          { upsert: true, new: true }
        );
      })
    );

    const addedCount = results.filter((r, i) => {
      // Yeni eklenen kayıtları say (createdAt ile kontrol et)
      return r.createdAt && r.createdAt.getTime() === r.updatedAt.getTime();
    }).length;

    return res.status(201).json({
      success: true,
      message: `${addedCount} yeni bölüm eklendi, ${results.length - addedCount} bölüm zaten mevcuttu.`,
      data: results,
    });
  } catch (error) {
    console.error("Error seeding departments:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Bölümler eklenirken bir hata oluştu.",
    });
  }
};

