import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadTemplate() {
  const templatePath = path.join(__dirname, "questionTemplate.json");
  return JSON.parse(fs.readFileSync(templatePath, "utf-8"));
}

// Check if OpenCV is enabled via environment variable
const ENABLE_OPENCV = process.env.ENABLE_OPENCV === "true";

// Try to load OpenCV - will be set dynamically in functions
let cv = null;

/**
 * Warp image using perspective transform and crop ROIs
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} markers - Marker coordinates
 * @returns {Promise<Object>} Warped image buffer and ROI definitions
 */
async function warpAndDefineROIs(imageBuffer, markers) {
  // Check if OpenCV is enabled
  if (!ENABLE_OPENCV) {
    throw new Error(
      "OpenCV is disabled (ENABLE_OPENCV=false). Perspective transform not available in this environment."
    );
  }
  
  // Try to load OpenCV if not already loaded
  if (!cv) {
    try {
      const cvModule = await import("opencv4nodejs").catch(() => null);
      cv = cvModule?.default || cvModule || null;
    } catch (error) {
      cv = null;
    }
  }
  
  if (!cv) {
    throw new Error(
      "Perspective transform requires opencv4nodejs. Please install: npm install opencv4nodejs or set ENABLE_OPENCV=true"
    );
  }

  try {
    // Target canvas size
    const targetWidth = 2480;
    const targetHeight = 3508;

    // Source points (markers)
    const srcPoints = [
      [markers.topLeft.x, markers.topLeft.y],
      [markers.topRight.x, markers.topRight.y],
      [markers.bottomLeft.x, markers.bottomLeft.y],
      [markers.bottomRight.x, markers.bottomRight.y],
    ];

    // Destination points (corners of target canvas)
    const dstPoints = [
      [0, 0],
      [targetWidth, 0],
      [0, targetHeight],
      [targetWidth, targetHeight],
    ];

    // Convert buffer to OpenCV Mat
    const image = cv.imdecode(imageBuffer);

    // Get perspective transform matrix
    const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcPoints.flat());
    const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPoints.flat());
    const transformMatrix = cv.getPerspectiveTransform(srcMat, dstMat);

    // Apply perspective transform
    const warped = image.warpPerspective(
      transformMatrix,
      new cv.Size(targetWidth, targetHeight)
    );

    // Convert back to buffer
    const warpedBuffer = Buffer.from(cv.imencode(".png", warped));

    // Define ROIs (fixed pixel regions after warping)
    // Soru numaralarına göre koordinatlar - yorum satırına alındı (artık kullanılmıyor)
    // const studentNumberBoxes = [
    //   { x: 900, y: 1150, w: 140, h: 140 },
    //   { x: 1040, y: 1150, w: 140, h: 140 },
    //   { x: 1180, y: 1150, w: 140, h: 140 },
    //   { x: 1320, y: 1150, w: 140, h: 140 },
    //   { x: 1460, y: 1150, w: 140, h: 140 },
    //   { x: 1600, y: 1150, w: 140, h: 140 },
    //   { x: 1740, y: 1150, w: 140, h: 140 },
    //   { x: 1880, y: 1150, w: 140, h: 140 },
    //   { x: 2020, y: 1150, w: 140, h: 140 },
    //   { x: 2160, y: 1150, w: 140, h: 140 },
    // ];

    // const examIdBoxes = [
    //   { x: 980, y: 1350, w: 140, h: 140 },
    //   { x: 1120, y: 1350, w: 140, h: 140 },
    // ];

    // Toplam Puan kutusu (ORİJİNAL sayfaya göre) ====
    // Toplam: (488, 1586, 1165, 1699) -> x=488, y=1586, w=677, h=113
    const totalScoreBox = {
      x: 488,
      y: 1586,
      w: 677,  // 1165 - 488
      h: 113,  // 1699 - 1586
    };

    return {
      warpedImage: warpedBuffer,
      // studentNumberBoxes, // Artık kullanılmıyor
      // examIdBoxes, // Artık kullanılmıyor
      totalScoreBox, // Sadece toplam puan kutusu kullanılıyor
    };
  } catch (error) {
    throw new Error(`ROI warping failed: ${error.message}`);
  }
}

/**
 * Crop a specific ROI from the warped image
 * @param {Buffer} warpedImageBuffer - Warped image buffer
 * @param {Object} roi - ROI definition {x, y, w, h}
 * @returns {Promise<Buffer>} Cropped image buffer
 */
async function cropROI(warpedImageBuffer, roi) {
  try {
    const cropped = await sharp(warpedImageBuffer)
      .extract({
        left: roi.x,
        top: roi.y,
        width: roi.w,
        height: roi.h,
      })
      .png()
      .toBuffer();

    return cropped;
  } catch (error) {
    throw new Error(`ROI cropping failed: ${error.message}`);
  }
}

/**
 * Crop genel puan kutusunu kes (marker varsa warp ile, yoksa template fallback)
 * @param {Buffer} pngBuffer - PNG image buffer
 * @param {Object} markers - Marker detection result
 * @returns {Promise<Object>} Cropped image buffer and file path
 */
async function cropTotalScoreBox(pngBuffer, markers) {
  // Save temp image helper
  const saveTempImage = (buffer, filename) => {
    const tempDir = path.join(process.cwd(), "temp", "exam_crops");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  };

  // Marker başarıyla bulunmuşsa warp + totalScoreBox
  if (markers?.success) {
    try {
      const { warpedImage, totalScoreBox } = await warpAndDefineROIs(pngBuffer, markers);
      const ts = Date.now();
      const filename = `total_score_${ts}.png`;
      const filePath = saveTempImage(buf, filename);
      return {
        buffer: buf,
        imagePath: filePath,
        imageFilename: filename,
      };
    } catch (warpError) {
      console.warn("⚠️ Warp failed, falling back to template coordinates:", warpError.message);
      // Fall through to template fallback below
    }
  }

  // Fallback: template koordinatları ile orijinal PNG üzerinden kes
  const imageMetadata = await sharp(pngBuffer).metadata();
  const imageWidth = imageMetadata.width || 2480;
  const imageHeight = imageMetadata.height || 3508;
  const template = loadTemplate();
  const totalScoreBoxes = template.totalScoreBoxes || [];

  console.log(`📐 Image dimensions: ${imageWidth}x${imageHeight}`);
  console.log(`📋 Using template fallback for total score`);

  // Yeni şablon: 20 puan kutusu varsa hepsini kes, toplam puan sonradan 20'sinin toplamı olacak
  if (totalScoreBoxes.length >= 20) {
    const buffers = [];
    for (let i = 0; i < 20; i++) {
      const box = totalScoreBoxes[i];
      const x = Math.round((box.xPercent || 0) * imageWidth / 100);
      const y = Math.round((box.yPercent || 0) * imageHeight / 100);
      const w = Math.max(1, Math.round((box.wPercent || 0) * imageWidth / 100));
      const h = Math.max(1, Math.round((box.hPercent || 0) * imageHeight / 100));
      if (x + w > imageWidth || y + h > imageHeight) continue;
      try {
        const buf = await sharp(pngBuffer)
          .extract({ left: x, top: y, width: w, height: h })
          .png()
          .toBuffer();
        buffers.push(buf);
      } catch (e) {
        console.warn(`⚠️ Crop box ${i + 1} failed:`, e.message);
      }
    }
    if (buffers.length === 20) {
      const ts = Date.now();
      const filename = `total_score_boxes_${ts}.png`;
      // Kullanıcının "kesilmiş hali" görmesi için 20 kutuyu tek görselde birleştir (4x5 grid)
      try {
        const meta = await sharp(buffers[0]).metadata();
        const cellW = (meta.width || 50) + 8;
        const cellH = (meta.height || 30) + 8;
        const cols = 5;
        const rows = 4;
        const compositeWidth = cols * cellW;
        const compositeHeight = rows * cellH;
        const composites = [];
        for (let i = 0; i < 20; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const left = col * cellW + 4;
          const top = row * cellH + 4;
          composites.push({
            input: buffers[i],
            left,
            top,
          });
        }
        const compositeBuffer = await sharp({
          create: {
            width: compositeWidth,
            height: compositeHeight,
            channels: 3,
            background: { r: 240, g: 240, b: 240 },
          },
        })
          .composite(composites)
          .png()
          .toBuffer();
        const filePath = saveTempImage(compositeBuffer, filename);
        console.log(`✅ Cropped 20 score boxes (template), composite saved: ${filePath}`);
        return {
          buffer: buffers[0],
          imagePath: filePath,
          imageFilename: filename,
          buffers,
        };
      } catch (compositeErr) {
        console.warn("⚠️ Composite image failed, saving first box only:", compositeErr.message);
        const filePath = saveTempImage(buffers[0], filename);
        return {
          buffer: buffers[0],
          imagePath: filePath,
          imageFilename: path.basename(filePath),
          buffers,
        };
      }
    }
    console.warn(`⚠️ Only ${buffers.length}/20 score boxes cropped, falling back to single box`);
  }

  // Tek toplam puan kutusu (eski şablon veya totalScoreBoxes yok)
  const ORIGINAL_TEMPLATE_WIDTH = 1654;
  const ORIGINAL_TEMPLATE_HEIGHT = 2339;
  const ORIGINAL_X = 488;
  const ORIGINAL_Y = 1586;
  const ORIGINAL_W = 677;
  const ORIGINAL_H = 113;
  const scaleX = imageWidth / ORIGINAL_TEMPLATE_WIDTH;
  const scaleY = imageHeight / ORIGINAL_TEMPLATE_HEIGHT;
  const x = Math.round(ORIGINAL_X * scaleX);
  const y = Math.round(ORIGINAL_Y * scaleY);
  const w = Math.round(ORIGINAL_W * scaleX);
  const h = Math.round(ORIGINAL_H * scaleY);

  console.log(`📏 Scaled coordinates: x=${x}, y=${y}, w=${w}, h=${h}`);
  if (x === undefined || y === undefined || w === undefined || h === undefined ||
      isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) || x < 0 || y < 0 || w <= 0 || h <= 0) {
    throw new Error(`Invalid coordinates for total score box: x=${x}, y=${y}, w=${w}, h=${h}`);
  }
  const adjustedW = Math.min(w, imageWidth - x);
  const adjustedH = Math.min(h, imageHeight - y);
  if (adjustedW <= 0 || adjustedH <= 0) {
    throw new Error(`Total score box cannot be cropped (out of bounds)`);
  }
  try {
    const buf = await sharp(pngBuffer)
      .extract({ left: x, top: y, width: adjustedW, height: adjustedH })
      .png()
      .toBuffer();
    const ts = Date.now();
    const filename = `total_score_${ts}.png`;
    const filePath = saveTempImage(buf, filename);
    console.log(`✅ Cropped total score box: x=${x}, y=${y}, w=${adjustedW}, h=${adjustedH}`);
    return {
      buffer: buf,
      imagePath: filePath,
      imageFilename: filename,
    };
  } catch (error) {
    throw new Error(`Failed to crop total score box: ${error.message}`);
  }
}

export { warpAndDefineROIs, cropROI, cropTotalScoreBox };

