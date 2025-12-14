import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// CORS configuration - Frontend URL'ini allow et
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://gaun-mudek.vercel.app', // Vercel frontend URL (hardcoded)
].filter(Boolean);

console.log('🔒 CORS Allowed Origins:', allowedOrigins);
console.log('🔒 FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('🔒 NODE_ENV:', process.env.NODE_ENV);

// CORS configuration with better error handling
const corsOptions = {
  origin: function (origin, callback) {
    // Same-origin requests (no origin header) - allow
    if (!origin) {
      console.log('✅ CORS: No origin header, allowing');
      return callback(null, true);
    }
    
    console.log('🌐 CORS Request from origin:', origin);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS: Origin in allowed list');
      return callback(null, true);
    }
    
    // Development mode: allow all origins
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ CORS: Development mode, allowing all');
      return callback(null, true);
    }
    
    // Allow localhost for local development (even in production mode on Render)
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      console.log('✅ CORS: Localhost detected, allowing');
      return callback(null, true);
    }
    
    // Production: allow vercel.app and onrender.com domains (for flexibility)
    // Check both endsWith and includes for better matching
    if (origin.includes('.vercel.app') || origin.includes('.onrender.com')) {
      console.log('✅ CORS: Vercel/Render domain detected, allowing');
      return callback(null, true);
    }
    
    // Also check if origin starts with https://gaun-mudek (any subdomain)
    if (origin.startsWith('https://gaun-mudek') || origin.includes('gaun-mudek')) {
      console.log('✅ CORS: gaun-mudek domain detected, allowing');
      return callback(null, true);
    }
    
    console.log('❌ CORS: Blocked origin:', origin);
    console.log('❌ CORS: Allowed origins:', allowedOrigins);
    // In production, still allow but log warning
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ CORS: Allowing blocked origin in production (should be fixed)');
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  preflightContinue: false, // Pass the CORS preflight response to the next handler
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend API is running",
    endpoints: {
      health: "/api/health",
      api: "/api",
      courses: "/api/courses",
      students: "/api/students",
      exams: "/api/exams",
    },
  });
});

// Debug route to test batch-status endpoint
app.get("/test-batch-status", (req, res) => {
  res.json({
    message: "Batch status test endpoint",
    path: "/api/exams/:examId/batch-status",
    example: "/api/exams/123/batch-status?batchId=batch_123",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
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

// Error handling middleware - must be after all routes to catch errors
// This ensures CORS headers are sent even when errors occur
app.use((err, req, res, next) => {
  // If it's a CORS error, send proper CORS headers with error
  if (err.message === 'Not allowed by CORS') {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    return res.status(403).json({ 
      success: false, 
      message: 'CORS policy violation',
      error: err.message 
    });
  }
  
  // For other errors, ensure CORS headers are still sent
  const origin = req.headers.origin;
  if (origin) {
    // Check if origin should be allowed (same logic as CORS)
    const isAllowed = !origin || 
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV !== 'production' ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      origin.startsWith('https://gaun-mudek');
    
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  // Log error for debugging
  console.error('Error handler caught:', err.message);
  
  // Send error response
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = !origin || 
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV !== 'production' ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      origin.startsWith('https://gaun-mudek');
    
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const MONGODB_DB = process.env.MONGODB_DB || "mudek";

// Render veya lokal için server'ı başlat
async function startServer() {
  console.log("=".repeat(50));
  console.log("🚀 Starting backend server...");
  console.log(`📦 Node version: ${process.version}`);
  console.log(`🖥️  Platform: ${process.platform}`);
  console.log(`📍 Working directory: ${process.cwd()}`);
  console.log(`🔧 PORT: ${PORT}`);
  console.log(`🔧 MONGODB_DB: ${MONGODB_DB}`);
  console.log(`🔧 MONGO_URI: ${MONGO_URI ? 'Set (hidden)' : 'NOT SET'}`);
  console.log("=".repeat(50));
  
  if (!MONGO_URI) {
    console.error("❌ MONGODB_URI (veya MONGO_URI) tanımlı değil. .env dosyanızı kontrol edin.");
    console.error("❌ Render'da Environment Variables'dan MONGODB_URI'yi eklediğinizden emin olun.");
    process.exit(1);
  }

  try {
    console.log("🔌 MongoDB'ye bağlanılıyor...");
    console.log(`📊 Database: ${MONGODB_DB}`);
    
    await mongoose.connect(MONGO_URI, {
      dbName: MONGODB_DB,
      serverSelectionTimeoutMS: 10000,
      bufferCommands: true,
      maxPoolSize: 10,
      minPoolSize: 1,
      socketTimeoutMS: 45000,
      family: 4,
    });
    
    console.log("✅ MongoDB bağlantısı kuruldu");
    console.log(`📊 Veritabanı: ${MONGODB_DB}`);

    const serverPort = process.env.PORT || PORT;
    const server = app.listen(serverPort, () => {
      console.log("=".repeat(50));
      console.log(`🚀 Backend running on port ${serverPort}`);
      console.log(`🌐 Health check: http://localhost:${serverPort}/api/health`);
      console.log(`🌐 API: http://localhost:${serverPort}/api`);
      console.log("=".repeat(50));
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed.');
          process.exit(0);
        });
      });
    });
    
  } catch (err) {
    console.error("=".repeat(50));
    console.error("❌ Server başlatma hatası:");
    console.error("❌ Error name:", err.name);
    console.error("❌ Error message:", err.message);
    if (err.stack) {
      console.error("❌ Error stack:", err.stack);
    }
    console.error("=".repeat(50));
    
    // MongoDB Atlas IP whitelist hatası
    if (err.name === "MongooseServerSelectionError" || err.message.includes("whitelist")) {
      console.error("\n💡 MongoDB Atlas IP Whitelist Hatası:");
      console.error("   Local development için IP adresinizi MongoDB Atlas'a eklemeniz gerekiyor:");
      console.error("   1. https://cloud.mongodb.com/ adresine gidin");
      console.error("   2. Network Access (Security > Network Access) bölümüne gidin");
      console.error("   3. 'Add IP Address' butonuna tıklayın");
      console.error("   4. 'Add Current IP Address' seçeneğini seçin VEYA");
      console.error("   5. 'Allow Access from Anywhere' (0.0.0.0/0) ekleyin (güvenlik riski var!)");
      console.error("\n   Render deployment için:");
      console.error("   - Render'ın IP adresleri dinamik olduğu için '0.0.0.0/0' eklemeniz gerekebilir");
      console.error("   - Veya sadece production için Render'ı kullanın, local için MongoDB Compass/local MongoDB kullanın");
    } 
    // MongoDB servisi çalışmıyor (local MongoDB)
    else if (err.message.includes("ECONNREFUSED") || err.message.includes("connect")) {
      console.error("\n💡 MongoDB servisi çalışmıyor. Lütfen MongoDB'yi başlatın:");
      console.error("   Windows: Yönetici olarak PowerShell açın ve şu komutu çalıştırın:");
      console.error("   Start-Service -Name MongoDB");
      console.error("\n   Veya Windows Services (services.msc) üzerinden 'MongoDB Server' servisini başlatın.");
      console.error(`\n   Bağlantı URI: ${MONGO_URI ? 'Set (hidden)' : 'NOT SET'}`);
    } 
    // Authentication hatası
    else if (err.message.includes("authentication failed") || err.message.includes("bad auth")) {
      console.error("\n💡 MongoDB authentication hatası:");
      console.error("   MongoDB Atlas kullanıyorsanız:");
      console.error("   1. Database User'ın password'ünü kontrol edin");
      console.error("   2. IP whitelist'e IP adresinizi ekleyin (yukarıya bakın)");
      console.error("   3. Connection string'deki username/password'ü kontrol edin");
    }
    // Diğer hatalar
    else {
      console.error("\n💡 MongoDB bağlantı hatası:");
      console.error(`   Hata türü: ${err.name}`);
      console.error(`   Hata mesajı: ${err.message}`);
    }
    
    process.exit(1);
  }
}

// Server'ı başlat
startServer().catch((err) => {
  console.error("❌ Fatal error in startServer:", err);
  process.exit(1);
});
