import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

// Gemini API test endpoint
app.get("/api/test-gemini", async (req, res) => {
  try {
    const { testGeminiAPI, listGeminiModels } = await import("./utils/geminiVision.js");
    
    // Önce mevcut modelleri listele
    console.log("📋 Mevcut modelleri listeliyor...");
    const modelList = await listGeminiModels();
    
    // Sonra test et
    const result = await testGeminiAPI();
    
    res.json({ 
      success: true, 
      data: {
        ...result,
        availableModels: modelList
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend API is running",
    endpoints: {
      health: "/api/health",
      courses: "/api/courses",
    },
  });
});

// Import all routes
import courseRoutes from "./routes/courseRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import programOutcomeRoutes from "./routes/programOutcomeRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import learningOutcomeRoutes from "./routes/learningOutcomeRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import scoreRoutes from "./routes/scoreRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";

// Mount all routes
app.use("/api/courses", courseRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/program-outcomes", programOutcomeRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/learning-outcomes", learningOutcomeRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/assessments", assessmentRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function startServer() {
  if (!MONGO_URI) {
    console.error("❌ MONGODB_URI (veya MONGO_URI) tanımlı değil. .env dosyanızı kontrol edin.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      // Veri kaybını önlemek için önemli ayarlar
      bufferCommands: true, // Bağlantı yokken komutları buffer'la
      maxPoolSize: 10, // Maksimum bağlantı sayısı
      minPoolSize: 1, // Minimum bağlantı sayısı
      socketTimeoutMS: 45000, // Socket timeout
      family: 4, // IPv4 kullan
    });
    console.log("✅ MongoDB bağlantısı kuruldu");
    console.log(`📊 Veritabanı: ${MONGO_URI.split('/').pop() || 'mudekdb'}`);

    // Bağlantı olaylarını dinle
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB bağlantı hatası:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB bağlantısı kesildi');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB yeniden bağlandı');
    });

    app.listen(PORT, () =>
      console.log(`Backend running at http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("❌ MongoDB bağlantı hatası:", err.message);
    
    // ECONNREFUSED hatası MongoDB servisinin çalışmadığını gösterir
    if (err.message.includes("ECONNREFUSED") || err.message.includes("connect")) {
      console.error("\n💡 MongoDB servisi çalışmıyor. Lütfen MongoDB'yi başlatın:");
      console.error("   Windows: Yönetici olarak PowerShell açın ve şu komutu çalıştırın:");
      console.error("   Start-Service -Name MongoDB");
      console.error("\n   Veya Windows Services (services.msc) üzerinden 'MongoDB Server' servisini başlatın.");
      console.error(`\n   Bağlantı URI: ${MONGO_URI}`);
    }
    
    process.exit(1);
  }
}

startServer();
