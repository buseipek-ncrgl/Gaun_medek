import mongoose from "mongoose";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Student from "../models/Student.js";
import Exam from "../models/Exam.js";
import Score from "../models/Score.js";
import Question from "../models/Question.js";
import LearningOutcome from "../models/LearningOutcome.js";
import ProgramOutcome from "../models/ProgramOutcome.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/mudekdb";

async function checkDataIntegrity() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ MongoDB bağlantısı kuruldu\n");

    // Veri sayılarını kontrol et
    const departments = await Department.countDocuments();
    const courses = await Course.countDocuments();
    const students = await Student.countDocuments();
    const exams = await Exam.countDocuments();
    const scores = await Score.countDocuments();
    const questions = await Question.countDocuments();
    const learningOutcomes = await LearningOutcome.countDocuments();
    const programOutcomes = await ProgramOutcome.countDocuments();

    console.log("📊 Veritabanı Durumu:");
    console.log(`   Bölümler: ${departments}`);
    console.log(`   Dersler: ${courses}`);
    console.log(`   Öğrenciler: ${students}`);
    console.log(`   Sınavlar: ${exams}`);
    console.log(`   Notlar: ${scores}`);
    console.log(`   Sorular: ${questions}`);
    console.log(`   Öğrenme Çıktıları: ${learningOutcomes}`);
    console.log(`   Program Çıktıları: ${programOutcomes}\n`);

    // İlişkisel bütünlük kontrolü
    const issues = [];

    // Derslerin bölüm referanslarını kontrol et
    const coursesWithInvalidDept = await Course.find({
      department: { $exists: true, $ne: null }
    });
    for (const course of coursesWithInvalidDept) {
      const dept = await Department.findById(course.department);
      if (!dept) {
        issues.push(`⚠️  Ders "${course.code}" geçersiz bölüm referansına sahip: ${course.department}`);
      }
    }

    // Sınavların ders referanslarını kontrol et
    const examsWithInvalidCourse = await Exam.find({
      courseId: { $exists: true, $ne: null }
    });
    for (const exam of examsWithInvalidCourse) {
      const course = await Course.findById(exam.courseId);
      if (!course) {
        issues.push(`⚠️  Sınav "${exam.examCode}" geçersiz ders referansına sahip: ${exam.courseId}`);
      }
    }

    // Öğrencilerin bölüm referanslarını kontrol et
    const studentsWithDept = await Student.find({
      department: { $exists: true, $ne: null, $type: "objectId" }
    });
    for (const student of studentsWithDept) {
      const dept = await Department.findById(student.department);
      if (!dept) {
        issues.push(`⚠️  Öğrenci "${student.studentNumber}" geçersiz bölüm referansına sahip: ${student.department}`);
      }
    }

    // Notların öğrenci referanslarını kontrol et
    const scoresWithInvalidStudent = await Score.find({
      studentId: { $exists: true, $ne: null }
    });
    for (const score of scoresWithInvalidStudent) {
      const student = await Student.findById(score.studentId);
      if (!student) {
        issues.push(`⚠️  Not kaydı geçersiz öğrenci referansına sahip: ${score.studentId}`);
      }
    }

    if (issues.length === 0) {
      console.log("✅ Veri bütünlüğü kontrolü: Sorun bulunamadı");
    } else {
      console.log("⚠️  Veri bütünlüğü sorunları:");
      issues.forEach(issue => console.log(`   ${issue}`));
    }

    await mongoose.disconnect();
    console.log("\n✅ Kontrol tamamlandı");
  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  }
}

checkDataIntegrity();
