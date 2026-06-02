import sharp from "sharp";

/**
 * OCR / Gemini için kırpılmış kutuyu iyileştirir: gri ton, kontrast, keskinleştirme.
 */
export async function preprocessForOcr(imageBuffer) {
  try {
    return await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1 })
      .png()
      .toBuffer();
  } catch {
    return imageBuffer;
  }
}

/**
 * OMR için tam sayfa kontrastını hafifçe artırır.
 */
export async function preprocessPageForOmr(imageBuffer) {
  try {
    return await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
  } catch {
    return imageBuffer;
  }
}

/**
 * Kırpma alanına küçük padding ekleyerek rakamın tam görünmesini sağlar.
 */
export function expandCropRect(x, y, w, h, imageWidth, imageHeight, paddingPercent = 0.08) {
  const padX = Math.round(w * paddingPercent);
  const padY = Math.round(h * paddingPercent);
  const left = Math.max(0, x - padX);
  const top = Math.max(0, y - padY);
  const right = Math.min(imageWidth, x + w + padX);
  const bottom = Math.min(imageHeight, y + h + padY);
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

/**
 * Kutu çoğunlukla boşsa true (Gemini çağrısını atlamak için).
 */
export async function isMostlyEmptyBox(imageBuffer, emptyThreshold = 235) {
  try {
    const { channels, data, info } = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (!data.length) return true;
    let sum = 0;
    for (let i = 0; i < data.length; i += channels) {
      sum += data[i];
    }
    const mean = sum / (data.length / channels);
    return mean >= emptyThreshold;
  } catch {
    return false;
  }
}
