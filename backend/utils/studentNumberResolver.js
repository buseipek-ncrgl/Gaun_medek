import sharp from "sharp";
import { readStudentNumberOMR } from "./omrStudentNumber.js";
import {
  extractStudentIdFromImage,
  extractStudentNumber,
  extractStudentNumberFromSingleBox,
} from "./geminiVision.js";
import { preprocessForOcr, expandCropRect } from "./imagePreprocess.js";

const FILENAME_REGEX = /\b(20\d{4,6}|\d{7,12})\b/;

function normalizeStudentNumber(value) {
  if (value == null) return null;
  const s = String(value).replace(/\D/g, "");
  return s.length >= 5 ? s : null;
}

function buildAllowedSet(allowedNumbers) {
  const set = new Set();
  if (!allowedNumbers) return set;
  for (const n of allowedNumbers) {
    const norm = normalizeStudentNumber(n);
    if (norm) set.add(norm);
  }
  return set;
}

function scoreCandidate(number, source, confidence, allowedSet) {
  let score = confidence;
  if (allowedSet.size > 0) {
    if (allowedSet.has(number)) score += 50;
    else {
      for (const allowed of allowedSet) {
        if (allowed.endsWith(number) || number.endsWith(allowed)) {
          score += 20;
          break;
        }
      }
    }
  }
  const sourceBonus = {
    filename: 15,
    omr: 40,
    template_single: 25,
    template_digits: 30,
    fullpage: 10,
  };
  score += sourceBonus[source] || 0;
  if (number.length === 12) score += 5;
  return score;
}

async function cropStudentNumberBox(pngBuffer, template) {
  const studentNumberBoxes = template.studentNumberBoxes || [];
  if (studentNumberBoxes.length === 0) return null;

  const imageMetadata = await sharp(pngBuffer).metadata();
  const imageWidth = imageMetadata.width || template.templateSize.width;
  const imageHeight = imageMetadata.height || template.templateSize.height;
  const box = studentNumberBoxes[0];
  const isSingleBox =
    box.digit === "all" ||
    (template.studentNumberBox && template.studentNumberBox.singleBox);

  if (isSingleBox && studentNumberBoxes.length === 1) {
    const x = Math.round((box.xPercent || 0) * imageWidth / 100);
    const y = Math.round((box.yPercent || 0) * imageHeight / 100);
    const w = Math.round((box.wPercent || 0) * imageWidth / 100);
    const h = Math.round((box.hPercent || 0) * imageHeight / 100);
    const rect = expandCropRect(x, y, w, h, imageWidth, imageHeight);
    if (rect.left + rect.width > imageWidth || rect.top + rect.height > imageHeight) {
      return null;
    }
    const buffer = await sharp(pngBuffer)
      .extract(rect)
      .png()
      .toBuffer();
    return { mode: "single", buffer: await preprocessForOcr(buffer) };
  }

  const digitBoxes = [];
  for (const b of studentNumberBoxes) {
    const x = Math.round((b.xPercent || 0) * imageWidth / 100);
    const y = Math.round((b.yPercent || 0) * imageHeight / 100);
    const w = Math.round((b.wPercent || 0) * imageWidth / 100);
    const h = Math.round((b.hPercent || 0) * imageHeight / 100);
    const rect = expandCropRect(x, y, w, h, imageWidth, imageHeight);
    if (rect.left + rect.width <= imageWidth && rect.top + rect.height <= imageHeight) {
      const buf = await sharp(pngBuffer).extract(rect).png().toBuffer();
      digitBoxes.push(await preprocessForOcr(buf));
    }
  }
  if (digitBoxes.length === studentNumberBoxes.length) {
    return { mode: "digits", buffers: digitBoxes };
  }
  return null;
}

/**
 * Tüm kaynaklardan öğrenci numarasını toplar; ders listesiyle eşleşeni seçer.
 * @param {object} opts
 * @param {string} opts.fileName
 * @param {Buffer} opts.pngBuffer
 * @param {object} opts.template - questionTemplate.json içeriği
 * @param {string[]} [opts.allowedNumbers] - Ders öğrenci numaraları
 * @returns {Promise<{ studentNumber: string, source: string, confidence: number }|null>}
 */
export async function resolveStudentNumber({ fileName, pngBuffer, template, allowedNumbers }) {
  const allowedSet = buildAllowedSet(allowedNumbers);
  const candidates = [];

  const nameMatch = fileName ? fileName.match(FILENAME_REGEX) : null;
  if (nameMatch) {
    const n = normalizeStudentNumber(nameMatch[0]);
    if (n) {
      candidates.push({ number: n, source: "filename", confidence: 90 });
    }
  }

  if (template.studentNumberOMR?.hanes?.length === 12) {
    try {
      const omrResult = await readStudentNumberOMR(pngBuffer, template);
      if (omrResult?.number) {
        candidates.push({
          number: omrResult.number,
          source: "omr",
          confidence: omrResult.confidence ?? 85,
        });
      }
    } catch (err) {
      console.warn("⚠️ OMR failed:", err.message);
    }
  }

  try {
    const crop = await cropStudentNumberBox(pngBuffer, template);
    if (crop?.mode === "single" && crop.buffer) {
      const n = await extractStudentNumberFromSingleBox(crop.buffer);
      const norm = normalizeStudentNumber(n);
      if (norm) {
        candidates.push({ number: norm, source: "template_single", confidence: 70 });
      }
    } else if (crop?.mode === "digits" && crop.buffers?.length) {
      const n = await extractStudentNumber(crop.buffers);
      const norm = normalizeStudentNumber(n);
      if (norm && norm.length >= 7) {
        candidates.push({ number: norm, source: "template_digits", confidence: 75 });
      }
    }
  } catch (err) {
    console.warn("⚠️ Template student number crop failed:", err.message);
  }

  try {
    const ocrId = await extractStudentIdFromImage(pngBuffer);
    const norm = normalizeStudentNumber(ocrId);
    if (norm) {
      candidates.push({ number: norm, source: "fullpage", confidence: 55 });
    }
  } catch (err) {
    console.warn("⚠️ Full-page OCR failed:", err.message);
  }

  if (candidates.length === 0) {
    console.error(`❌ No student number candidates from: "${fileName}"`);
    return null;
  }

  const byNumber = new Map();
  for (const c of candidates) {
    const key = c.number;
    const scored = { ...c, totalScore: scoreCandidate(c.number, c.source, c.confidence, allowedSet) };
    const existing = byNumber.get(key);
    if (!existing) {
      byNumber.set(key, scored);
    } else {
      existing.totalScore += 15;
      existing.confidence = Math.min(99, Math.max(existing.confidence, scored.confidence) + 5);
      if (scored.totalScore > existing.totalScore - 15) {
        existing.source = `${existing.source}+${scored.source}`;
      }
    }
  }

  const ranked = [...byNumber.values()].sort((a, b) => b.totalScore - a.totalScore);
  const best = ranked[0];
  const consensus = ranked.filter((r) => r.number === best.number).length;

  if (allowedSet.size > 0 && !allowedSet.has(best.number)) {
    const inList = ranked.find((r) => allowedSet.has(r.number));
    if (inList && inList.totalScore >= best.totalScore - 25) {
      console.log(
        `📋 Student number: listed match "${inList.number}" (${inList.source}) over raw best "${best.number}"`
      );
      return {
        studentNumber: inList.number,
        source: inList.source,
        confidence: inList.confidence,
        alternatives: ranked.slice(0, 3).map((r) => r.number),
      };
    }
    console.warn(
      `⚠️ Best student number "${best.number}" not in course list (${allowedSet.size} students)`
    );
  }

  console.log(
    `✅ Resolved student number: ${best.number} (source=${best.source}, score=${best.totalScore}, consensus=${consensus})`
  );

  return {
    studentNumber: best.number,
    source: best.source,
    confidence: best.confidence,
    alternatives: ranked.slice(1, 3).map((r) => r.number),
  };
}

export function getCourseStudentNumbers(course) {
  if (!course?.students?.length) return [];
  return course.students
    .map((s) => s.studentNumber || s.number || s)
    .filter(Boolean);
}
