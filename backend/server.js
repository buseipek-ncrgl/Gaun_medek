import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { generalLimiter, createUpdateLimiter, aiLimiter } from "./middleware/rateLimiter.js";
import logger from "./utils/logger.js";

dotenv.config();

// Log environment configuration
logger.info('🔧 Environment Configuration', {
  NODE_ENV: process.env.NODE_ENV || 'not set',
  ENABLE_OPENCV: process.env.ENABLE_OPENCV || 'not set (default: false)',
  ENABLE_PDF_POPPLER: process.env.ENABLE_PDF_POPPLER || 'not set (default: true)',
  Platform: process.platform,
});
if (process.env.ENABLE_OPENCV !== 'true') {
  logger.warn('⚠️ OpenCV is DISABLED. Marker detection and perspective transform will use fallback methods.');
}
if (process.env.ENABLE_PDF_POPPLER === 'false') {
  logger.warn('⚠️ PDF-Poppler is DISABLED. Using pdftoppm fallback.');
}

const app = express();

// CORS configuration - Frontend URL'ini allow et
// Normalize URLs by removing trailing slashes
const normalizeUrl = (url) => url ? url.replace(/\/$/, '') : null;
const allowedOrigins = [
  normalizeUrl(process.env.FRONTEND_URL),
  'http://localhost:3000',
  'http://localhost:3001',
  'https://gaun-medek.vercel.app', // Vercel frontend URL (hardcoded)
].filter(Boolean);

logger.info('🔒 CORS Configuration', {
  allowedOrigins,
  FRONTEND_URL: process.env.FRONTEND_URL,
  NODE_ENV: process.env.NODE_ENV,
});

// CORS configuration with better error handling
const corsOptions = {
  origin: function (origin, callback) {
    // Same-origin requests (no origin header) - allow
    if (!origin) {
      logger.debug('✅ CORS: No origin header, allowing');
      return callback(null, true);
    }
    
    logger.debug('🌐 CORS Request from origin', { origin });
    
    // Normalize origin for comparison (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Check if origin is in allowed list (exact match or normalized match)
    if (allowedOrigins.includes(origin) || allowedOrigins.includes(normalizedOrigin)) {
      logger.debug('✅ CORS: Origin in allowed list');
      return callback(null, true);
    }
    
    // Development mode: allow all origins
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('✅ CORS: Development mode, allowing all');
      return callback(null, true);
    }
    
    // Allow localhost for local development (even in production mode on Render)
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      logger.debug('✅ CORS: Localhost detected, allowing');
      return callback(null, true);
    }
    
    // Production: allow vercel.app and onrender.com domains (for flexibility)
    // Check both endsWith and includes for better matching
    if (origin.includes('.vercel.app') || origin.includes('.onrender.com')) {
      logger.debug('✅ CORS: Vercel/Render domain detected, allowing');
      return callback(null, true);
    }
    
    // Also check if origin starts with https://gaun-medek (any subdomain)
    if (origin.startsWith('https://gaun-medek') || origin.includes('gaun-medek')) {
      logger.debug('✅ CORS: gaun-medek domain detected, allowing');
      return callback(null, true);
    }
    
    logger.warn('❌ CORS: Blocked origin', { origin, allowedOrigins });
    // In production, still allow but log warning
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️ CORS: Allowing blocked origin in production (should be fixed)');
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

// Tüm JSON yanıtlarında UTF-8 charset (Türkçe karakterler için)
app.use((req, res, next) => {
  const _json = res.json.bind(res);
  res.json = function (body) {
    res.set("Content-Type", "application/json; charset=utf-8");
    return res.send(JSON.stringify(body));
  };
  next();
});

// Apply rate limiting to all API routes (skip in development)
if (process.env.NODE_ENV === 'production') {
  app.use('/api', generalLimiter);
} else {
  logger.info('⚠️ Rate limiting DISABLED in development mode');
}

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
import programRoutes from "./routes/programRoutes.js";
import programOutcomeRoutes from "./routes/programOutcomeRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import learningOutcomeRoutes from "./routes/learningOutcomeRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import scoreRoutes from "./routes/scoreRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import authRoutes from "./routes/authRoutes.js";

// Mount all routes
app.use("/api/auth", authRoutes);
// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
  app.use("/api/courses", createUpdateLimiter, courseRoutes);
} else {
  app.use("/api/courses", courseRoutes);
}
app.use("/api/departments", departmentRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/program-outcomes", programOutcomeRoutes);
// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
  app.use("/api/exams", createUpdateLimiter, examRoutes);
} else {
  app.use("/api/exams", examRoutes);
}
app.use("/api/questions", questionRoutes);
app.use("/api/learning-outcomes", learningOutcomeRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/scores", scoreRoutes);
// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
  app.use("/api/ai", aiLimiter, aiRoutes);
} else {
  app.use("/api/ai", aiRoutes);
}
app.use("/api/assessments", assessmentRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/notifications", notificationRoutes);

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
      origin.startsWith('https://gaun-medek');
    
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  // Log error for debugging (logger will be used in globalErrorHandler)
  
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
      origin.startsWith('https://gaun-medek');
    
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

const PORT = process.env.PORT || 5001; // Default 5001 (5000'de macOS ControlCenter çalışıyor)
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const MONGODB_DB = process.env.MONGODB_DB || "mudek";

// Render veya lokal için server'ı başlat
async function startServer() {
  logger.info("=".repeat(50));
  logger.info("🚀 Starting backend server...");
  logger.info("Server Configuration", {
    nodeVersion: process.version,
    platform: process.platform,
    workingDirectory: process.cwd(),
    port: PORT,
    mongodbDb: MONGODB_DB,
    mongoUriSet: !!MONGO_URI,
  });
  logger.info("=".repeat(50));
  
  if (!MONGO_URI) {
    logger.error("❌ MONGODB_URI (veya MONGO_URI) tanımlı değil. .env dosyanızı kontrol edin.");
    logger.error("❌ Render'da Environment Variables'dan MONGODB_URI'yi eklediğinizden emin olun.");
    process.exit(1);
  }

  try {
    logger.info("🔌 MongoDB'ye bağlanılıyor...", { database: MONGODB_DB });
    
    await mongoose.connect(MONGO_URI, {
      dbName: MONGODB_DB,
      serverSelectionTimeoutMS: 10000,
      bufferCommands: true,
      maxPoolSize: 10,
      minPoolSize: 1,
      socketTimeoutMS: 45000,
      family: 4,
    });
    
    logger.info("✅ MongoDB bağlantısı kuruldu", { database: MONGODB_DB });

    const serverPort = process.env.PORT || PORT; // Default 5001
    const server = app.listen(serverPort, () => {
      logger.info("=".repeat(50));
      logger.info(`🚀 Backend running on port ${serverPort}`);
      logger.info("Server URLs", {
        healthCheck: `http://localhost:${serverPort}/api/health`,
        api: `http://localhost:${serverPort}/api`,
      });
      logger.info("=".repeat(50));
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        mongoose.connection.close(false, () => {
          logger.info('MongoDB connection closed.');
          process.exit(0);
        });
      });
    });
    
  } catch (err) {
    logger.error("=".repeat(50));
    logger.error("❌ Server başlatma hatası", {
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
    });
    logger.error("=".repeat(50));
    
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
