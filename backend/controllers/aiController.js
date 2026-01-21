import multer from "multer";
import { pdfToPng } from "../utils/pdfToPng.js";
import { detectMarkers } from "../utils/markerDetect.js";
import { warpAndDefineROIs, cropROI, cropTotalScoreBox } from "../utils/roiCrop.js";
import {
  extractStudentNumber,
  extractExamId,
  extractNumberFromImage,
} from "../utils/geminiVision.js";

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and image files are allowed"), false);
    }
  },
});

/**
 * Process exam PDF and extract data using AI
 * POST /api/ai/process
 */
const processExam = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Step 1: Convert PDF to PNG
    let imageBuffer;
    if (req.file.mimetype === "application/pdf") {
      const { buffer } = await pdfToPng(req.file.buffer);
      imageBuffer = buffer;
    } else {
      // Already an image
      imageBuffer = req.file.buffer;
    }

    // Step 2: Detect template markers
    const markers = await detectMarkers(imageBuffer);
    console.log(`📸 Marker detection: ${markers?.success ? 'Success' : 'Failed (using fallback)'}`);

    // Step 3: Warp image and define ROIs (marker varsa warp, yoksa template fallback)
    let warpedImage, studentNumberBoxes, examIdBoxes, totalScoreBox;
    
    if (markers?.success) {
      try {
        const rois = await warpAndDefineROIs(imageBuffer, markers);
        warpedImage = rois.warpedImage;
        studentNumberBoxes = rois.studentNumberBoxes;
        examIdBoxes = rois.examIdBoxes;
        totalScoreBox = rois.totalScoreBox;
        console.log(`✅ Image warped successfully using markers`);
      } catch (warpError) {
        console.warn(`⚠️ Warp failed: ${warpError.message}, using fallback`);
        // Fallback: Use original image with template coordinates
        warpedImage = imageBuffer;
        studentNumberBoxes = [
          { x: 900, y: 1150, w: 140, h: 140 },
          { x: 1040, y: 1150, w: 140, h: 140 },
          { x: 1180, y: 1150, w: 140, h: 140 },
          { x: 1320, y: 1150, w: 140, h: 140 },
          { x: 1460, y: 1150, w: 140, h: 140 },
          { x: 1600, y: 1150, w: 140, h: 140 },
          { x: 1740, y: 1150, w: 140, h: 140 },
          { x: 1880, y: 1150, w: 140, h: 140 },
          { x: 2020, y: 1150, w: 140, h: 140 },
          { x: 2160, y: 1150, w: 140, h: 140 },
        ];
        examIdBoxes = [
          { x: 980, y: 1350, w: 140, h: 140 },
          { x: 1120, y: 1350, w: 140, h: 140 },
        ];
        totalScoreBox = { x: 1500, y: 1650, w: 350, h: 120 };
      }
    } else {
      // No markers detected, use template fallback
      console.log(`📋 Using template fallback (no markers detected)`);
      warpedImage = imageBuffer;
      studentNumberBoxes = [
        { x: 900, y: 1150, w: 140, h: 140 },
        { x: 1040, y: 1150, w: 140, h: 140 },
        { x: 1180, y: 1150, w: 140, h: 140 },
        { x: 1320, y: 1150, w: 140, h: 140 },
        { x: 1460, y: 1150, w: 140, h: 140 },
        { x: 1600, y: 1150, w: 140, h: 140 },
        { x: 1740, y: 1150, w: 140, h: 140 },
        { x: 1880, y: 1150, w: 140, h: 140 },
        { x: 2020, y: 1150, w: 140, h: 140 },
        { x: 2160, y: 1150, w: 140, h: 140 },
      ];
      examIdBoxes = [
        { x: 980, y: 1350, w: 140, h: 140 },
        { x: 1120, y: 1350, w: 140, h: 140 },
      ];
      totalScoreBox = { x: 1500, y: 1650, w: 350, h: 120 };
    }

    // Step 4: Crop all ROIs
    // 4a) Öğrenci numarası (10 kutu)
    const studentNumberCrops = await Promise.all(
      studentNumberBoxes.map((box) => cropROI(warpedImage, box))
    );

    // 4b) Sınav kodu (2 kutu)
    const examIdCrops = await Promise.all(
      examIdBoxes.map((box) => cropROI(warpedImage, box))
    );

    // 4c) Genel puan kutusu (tek kutu)
    const totalScoreCrop = await cropROI(warpedImage, totalScoreBox);

    // Step 5: Extract data using Gemini Vision API
    console.log(`🔍 Extracting student number from ${studentNumberCrops.length} boxes...`);
    const studentNumber = await extractStudentNumber(studentNumberCrops);
    
    console.log(`🔍 Extracting exam ID from ${examIdCrops.length} boxes...`);
    const examId = await extractExamId(examIdCrops);
    
    console.log(`🔍 Extracting total score from single box...`);
    const totalScore = await extractNumberFromImage(totalScoreCrop, "total score");

    // Generate session ID for frontend tracking
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const result = {
      sessionId,
      studentNumber,
      examId,
      totalScore, // Tek genel puan
    };

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("AI processing error:", error);
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "AI could not process the exam sheet. Check template or values.",
    });
  }
};

export {
  processExam,
  upload,
};

