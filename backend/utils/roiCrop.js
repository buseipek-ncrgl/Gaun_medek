import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { preprocessForOcr, expandCropRect } from "./imagePreprocess.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadTemplate() {
  const templatePath = path.join(__dirname, "questionTemplate.json");
  return JSON.parse(fs.readFileSync(templatePath, "utf-8"));
}

const ENABLE_OPENCV = process.env.ENABLE_OPENCV === "true";
const SAVE_CROP_DEBUG = process.env.SAVE_EXAM_CROPS === "true";

let cv = null;

function saveTempImage(buffer, filename) {
  if (!SAVE_CROP_DEBUG || !buffer) return null;
  const tempDir = path.join(process.cwd(), "temp", "exam_crops");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Şablon yüzdelerine göre puan kutularını keser (ön işleme uygulanır).
 */
async function cropScoreBoxesFromImage(pngBuffer, imageWidth, imageHeight, totalScoreBoxes) {
  const buffers = [];
  for (let i = 0; i < Math.min(20, totalScoreBoxes.length); i++) {
    const box = totalScoreBoxes[i];
    const x = Math.round((box.xPercent || 0) * imageWidth / 100);
    const y = Math.round((box.yPercent || 0) * imageHeight / 100);
    const w = Math.max(1, Math.round((box.wPercent || 0) * imageWidth / 100));
    const h = Math.max(1, Math.round((box.hPercent || 0) * imageHeight / 100));
    const rect = expandCropRect(x, y, w, h, imageWidth, imageHeight);
    if (rect.left + rect.width > imageWidth || rect.top + rect.height > imageHeight) {
      continue;
    }
    try {
      const raw = await sharp(pngBuffer).extract(rect).png().toBuffer();
      buffers.push(await preprocessForOcr(raw));
    } catch (e) {
      console.warn(`⚠️ Crop box ${i + 1} failed:`, e.message);
    }
  }
  return buffers;
}

async function warpAndDefineROIs(imageBuffer, markers) {
  if (!ENABLE_OPENCV) {
    throw new Error(
      "OpenCV is disabled (ENABLE_OPENCV=false). Perspective transform not available in this environment."
    );
  }

  if (!cv) {
    try {
      const cvModule = await import("opencv4nodejs").catch(() => null);
      cv = cvModule?.default || cvModule || null;
    } catch {
      cv = null;
    }
  }

  if (!cv) {
    throw new Error(
      "Perspective transform requires opencv4nodejs or set ENABLE_OPENCV=true"
    );
  }

  const targetWidth = 2480;
  const targetHeight = 3508;

  const srcPoints = [
    [markers.topLeft.x, markers.topLeft.y],
    [markers.topRight.x, markers.topRight.y],
    [markers.bottomLeft.x, markers.bottomLeft.y],
    [markers.bottomRight.x, markers.bottomRight.y],
  ];

  const dstPoints = [
    [0, 0],
    [targetWidth, 0],
    [0, targetHeight],
    [targetWidth, targetHeight],
  ];

  const image = cv.imdecode(imageBuffer);
  const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcPoints.flat());
  const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPoints.flat());
  const transformMatrix = cv.getPerspectiveTransform(srcMat, dstMat);
  const warped = image.warpPerspective(
    transformMatrix,
    new cv.Size(targetWidth, targetHeight)
  );
  const warpedBuffer = Buffer.from(cv.imencode(".png", warped));

  return {
    warpedImage: warpedBuffer,
    targetWidth,
    targetHeight,
  };
}

async function cropROI(warpedImageBuffer, roi) {
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
}

async function buildCompositePreview(buffers) {
  const meta = await sharp(buffers[0]).metadata();
  const cellW = (meta.width || 50) + 8;
  const cellH = (meta.height || 30) + 8;
  const cols = 5;
  const rows = 4;
  const composites = [];
  for (let i = 0; i < buffers.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    composites.push({
      input: buffers[i],
      left: col * cellW + 4,
      top: row * cellH + 4,
    });
  }
  return sharp({
    create: {
      width: cols * cellW,
      height: rows * cellH,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * Crop genel puan kutusu (marker warp veya şablon fallback).
 */
async function cropTotalScoreBox(pngBuffer, markers) {
  const template = loadTemplate();
  const totalScoreBoxes = template.totalScoreBoxes || [];

  if (markers?.success && ENABLE_OPENCV) {
    try {
      const { warpedImage, targetWidth, targetHeight } = await warpAndDefineROIs(
        pngBuffer,
        markers
      );
      console.log(`✅ Warped image ${targetWidth}x${targetHeight} for score crops`);

      if (totalScoreBoxes.length >= 20) {
        const buffers = await cropScoreBoxesFromImage(
          warpedImage,
          targetWidth,
          targetHeight,
          totalScoreBoxes
        );
        if (buffers.length === 20) {
          const ts = Date.now();
          const filename = `warped_score_boxes_${ts}.png`;
          let filePath = null;
          try {
            const composite = await buildCompositePreview(buffers);
            filePath = saveTempImage(composite, filename);
          } catch {
            filePath = saveTempImage(buffers[0], filename);
          }
          return {
            buffer: buffers[0],
            imagePath: filePath,
            imageFilename: filename,
            buffers,
            method: "warp_template",
          };
        }
      }

      const ORIGINAL_X = 488;
      const ORIGINAL_Y = 1586;
      const ORIGINAL_W = 677;
      const ORIGINAL_H = 113;
      const scaleX = targetWidth / 1654;
      const scaleY = targetHeight / 2339;
      const roi = {
        x: Math.round(ORIGINAL_X * scaleX),
        y: Math.round(ORIGINAL_Y * scaleY),
        w: Math.round(ORIGINAL_W * scaleX),
        h: Math.round(ORIGINAL_H * scaleY),
      };
      const raw = await cropROI(warpedImage, roi);
      const buf = await preprocessForOcr(raw);
      const ts = Date.now();
      const filename = `warped_total_score_${ts}.png`;
      const filePath = saveTempImage(buf, filename);
      return {
        buffer: buf,
        imagePath: filePath,
        imageFilename: filename,
        method: "warp_single",
      };
    } catch (warpError) {
      console.warn("⚠️ Warp failed, falling back to template coordinates:", warpError.message);
    }
  }

  const imageMetadata = await sharp(pngBuffer).metadata();
  const imageWidth = imageMetadata.width || 2480;
  const imageHeight = imageMetadata.height || 3508;

  console.log(`📐 Image dimensions: ${imageWidth}x${imageHeight}`);
  console.log(`📋 Using template fallback for total score`);

  if (totalScoreBoxes.length >= 20) {
    const buffers = await cropScoreBoxesFromImage(
      pngBuffer,
      imageWidth,
      imageHeight,
      totalScoreBoxes
    );
    if (buffers.length === 20) {
      const ts = Date.now();
      const filename = `total_score_boxes_${ts}.png`;
      let filePath = null;
      try {
        const composite = await buildCompositePreview(buffers);
        filePath = saveTempImage(composite, filename);
      } catch (compositeErr) {
        console.warn("⚠️ Composite image failed:", compositeErr.message);
        filePath = saveTempImage(buffers[0], filename);
      }
      console.log(
        `✅ Cropped 20 score boxes (template)${filePath ? ` → ${filePath}` : ""}`
      );
      return {
        buffer: buffers[0],
        imagePath: filePath,
        imageFilename: filename,
        buffers,
        method: "template",
      };
    }
    console.warn(`⚠️ Only ${buffers.length}/20 score boxes cropped, falling back to single box`);
  }

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
  const adjustedW = Math.min(w, imageWidth - x);
  const adjustedH = Math.min(h, imageHeight - y);

  const raw = await sharp(pngBuffer)
    .extract({ left: x, top: y, width: adjustedW, height: adjustedH })
    .png()
    .toBuffer();
  const buf = await preprocessForOcr(raw);
  const ts = Date.now();
  const filename = `total_score_${ts}.png`;
  const filePath = saveTempImage(buf, filename);
  return {
    buffer: buf,
    imagePath: filePath,
    imageFilename: filename,
    method: "template_single",
  };
}

export { warpAndDefineROIs, cropROI, cropTotalScoreBox, cropScoreBoxesFromImage };
