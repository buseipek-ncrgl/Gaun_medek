import mongoose from "mongoose";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Student from "../models/Student.js";
import Exam from "../models/Exam.js";
import Score from "../models/Score.js";
import Question from "../models/Question.js";
import LearningOutcome from "../models/LearningOutcome.js";
import ProgramOutcome from "../models/ProgramOutcome.js";
import { writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/mudekdb";

async function backupData() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ MongoDB bağlantısı kuruldu");

    // Tüm verileri al
    const departments = await Department.find().lean();
    const courses = await Course.find().lean();
    const students = await Student.find().lean();
    const exams = await Exam.find().lean();
    const scores = await Score.find().lean();
    const questions = await Question.find().lean();
    const learningOutcomes = await LearningOutcome.find().lean();
    const programOutcomes = await ProgramOutcome.find().lean();

    // Yedek objesi oluştur
    const backup = {
      timestamp: new Date().toISOString(),
      counts: {
        departments: departments.length,
        courses: courses.length,
        students: students.length,
        exams: exams.length,
        scores: scores.length,
        questions: questions.length,
        learningOutcomes: learningOutcomes.length,
        programOutcomes: programOutcomes.length,
      },
      data: {
        departments,
        courses,
        students,
        exams,
        scores,
        questions,
        learningOutcomes,
        programOutcomes,
      },
    };

    // Yedek dosyasını kaydet
    const backupDir = join(__dirname, "../backups");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = join(backupDir, `backup-${timestamp}.json`);

    // Backup klasörünü oluştur (yoksa)
    try {
      await import("fs/promises").then(fs => fs.mkdir(backupDir, { recursive: true }));
    } catch (err) {
      // Klasör zaten varsa hata verme
    }

    writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf-8");

    console.log("\n📊 Yedek Özeti:");
    console.log(`   Bölümler: ${departments.length}`);
    console.log(`   Dersler: ${courses.length}`);
    console.log(`   Öğrenciler: ${students.length}`);
    console.log(`   Sınavlar: ${exams.length}`);
    console.log(`   Notlar: ${scores.length}`);
    console.log(`   Sorular: ${questions.length}`);
    console.log(`   Öğrenme Çıktıları: ${learningOutcomes.length}`);
    console.log(`   Program Çıktıları: ${programOutcomes.length}`);
    console.log(`\n✅ Yedek kaydedildi: ${backupPath}`);

    await mongoose.disconnect();
    console.log("✅ İşlem tamamlandı");
  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  }
}

backupData();
