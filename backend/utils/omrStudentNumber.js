/**
 * Öğrenci numarası OMR: 12 hane, her hanede 0-9 balon.
 * Çift işaret ve belirsiz sütun tespiti ile daha güvenilir okuma.
 */

import sharp from "sharp";
import { preprocessPageForOmr } from "./imagePreprocess.js";

/** İlk ve ikinci en koyu balon farkı bu değerden küçükse sütun belirsiz */
const AMBIGUITY_GAP = 14;
/** Varsayılan dolu balon üst sınırı (0-255, düşük = dolu) */
const DEFAULT_FILLED_THRESHOLD = 235;

async function getBubbleDarkness(imageBuffer, cx, cy, r, imageWidth, imageHeight) {
  const size = Math.max(2, Math.ceil(r * 2.5));
  const left = Math.max(0, Math.floor(cx - size));
  const top = Math.max(0, Math.floor(cy - size));
  const width = Math.min(size * 2, imageWidth - left);
  const height = Math.min(size * 2, imageHeight - top);
  if (width < 2 || height < 2) return 255;

  const data = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .grayscale()
    .raw()
    .toBuffer();

  const localCx = cx - left;
  const localCy = cy - top;
  const r2 = r * r;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - localCx;
      const dy = y - localCy;
      if (dx * dx + dy * dy <= r2) {
        sum += data[y * width + x];
        count++;
      }
    }
  }
  return count > 0 ? sum / count : 255;
}

/**
 * @returns {Promise<{ number: string, confidence: number, ambiguousHanes: number[] }|null>}
 */
async function readStudentNumberOMR(imageBuffer, template) {
  const omr = template.studentNumberOMR;
  if (!omr || !omr.hanes || omr.hanes.length !== 12) {
    return null;
  }

  const ref = omr.referenceSize || template.templateSize || { width: 1654, height: 2339 };
  const refW = ref.width || 1654;
  const refH = ref.height || 2339;

  const pageBuffer = await preprocessPageForOmr(imageBuffer);
  const metadata = await sharp(pageBuffer).metadata();
  const imgW = metadata.width || refW;
  const imgH = metadata.height || refH;
  const scaleX = imgW / refW;
  const scaleY = imgH / refH;

  const allDarknesses = [];
  const columnResults = [];

  for (let haneIndex = 0; haneIndex < omr.hanes.length; haneIndex++) {
    const hane = omr.hanes[haneIndex];
    const readings = [];
    for (const d of hane.digits) {
      const cx = d.x * scaleX;
      const cy = d.y * scaleY;
      const r = Math.max(2, (d.r || 10) * Math.min(scaleX, scaleY));
      const darkness = await getBubbleDarkness(pageBuffer, cx, cy, r, imgW, imgH);
      readings.push({ digit: d.digit, darkness });
      allDarknesses.push(darkness);
    }
    readings.sort((a, b) => a.darkness - b.darkness);
    const best = readings[0];
    const second = readings[1];
    const gap = second ? second.darkness - best.darkness : 255;
    const ambiguous = gap < AMBIGUITY_GAP;
    columnResults.push({
      haneIndex,
      digit: best?.digit ?? null,
      minDarkness: best?.darkness ?? 255,
      gap,
      ambiguous,
      doubleMark: gap < AMBIGUITY_GAP && best && second,
    });
  }

  const sortedAll = [...allDarknesses].sort((a, b) => a - b);
  const medianDarkness =
    sortedAll.length > 0 ? sortedAll[Math.floor(sortedAll.length / 2)] : 200;
  const filledThreshold = Math.min(
    DEFAULT_FILLED_THRESHOLD,
    Math.max(200, medianDarkness + 35)
  );

  const ambiguousHanes = columnResults
    .filter((c) => c.ambiguous || c.minDarkness > filledThreshold)
    .map((c) => c.haneIndex);

  if (ambiguousHanes.length > 0) {
    console.warn(
      `⚠️ OMR ambiguous/empty columns: ${ambiguousHanes.join(", ")} (threshold=${filledThreshold.toFixed(0)})`
    );
    return null;
  }

  const digits = columnResults.map((c) => String(c.digit));
  const studentNumber = digits.join("");
  if (studentNumber.length !== 12) return null;

  const avgGap =
    columnResults.reduce((s, c) => s + (c.gap || 0), 0) / columnResults.length;
  const confidence = Math.min(98, Math.round(60 + Math.min(avgGap, 40)));

  console.log(`✅ OMR read: ${studentNumber} (confidence=${confidence})`);
  return { number: studentNumber, confidence, ambiguousHanes: [] };
}

export { readStudentNumberOMR, getBubbleDarkness };
