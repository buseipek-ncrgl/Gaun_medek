/**
 * Öğrenci numarası OMR (optik işaret) okuma: 12 hane, her hanede 0-9 yuvarlak balon.
 * Hangi balon doluysa o rakam okunur. Koordinatlar şablondaki referenceSize'a göre pikseldir;
 * görüntü farklı boyuttaysa ölçeklenir.
 */

import sharp from "sharp";

/**
 * Bir balon bölgesinin ortalama koyuluk (0-255, düşük = dolu) değerini hesaplar.
 * @param {Buffer} imageBuffer - PNG/JPEG buffer
 * @param {number} cx - Merkez x (piksel)
 * @param {number} cy - Merkez y (piksel)
 * @param {number} r - Yarıçap (piksel)
 * @param {number} imageWidth - Görüntü genişliği
 * @param {number} imageHeight - Görüntü yüksekliği
 * @returns {Promise<number>} Ortalama piksel değeri (0-255, düşük = daha koyu = dolu)
 */
async function getBubbleDarkness(imageBuffer, cx, cy, r, imageWidth, imageHeight) {
  const size = Math.max(2, Math.ceil(r * 2.5)); // kare kenarı
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
  const channels = 1; // grayscale
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
        const idx = (y * width + x) * channels;
        sum += data[idx];
        count++;
      }
    }
  }
  return count > 0 ? sum / count : 255;
}

/**
 * Şablondaki studentNumberOMR ile görüntüden 12 haneli öğrenci numarasını okur.
 * Her hanede en koyu (dolu) balon o hanenin rakamı kabul edilir.
 * @param {Buffer} imageBuffer - Sayfa görüntüsü (PNG/JPEG)
 * @param {object} template - questionTemplate (studentNumberOMR ve templateSize içermeli)
 * @returns {Promise<string|null>} 12 haneli öğrenci numarası veya null
 */
async function readStudentNumberOMR(imageBuffer, template) {
  const omr = template.studentNumberOMR;
  if (!omr || !omr.hanes || omr.hanes.length !== 12) {
    return null;
  }

  const ref = omr.referenceSize || template.templateSize || { width: 1654, height: 2339 };
  const refW = ref.width || 1654;
  const refH = ref.height || 2339;

  const metadata = await sharp(imageBuffer).metadata();
  const imgW = metadata.width || refW;
  const imgH = metadata.height || refH;
  const scaleX = imgW / refW;
  const scaleY = imgH / refH;

  const digits = [];
  for (const hane of omr.hanes) {
    let minDarkness = 255;
    let selectedDigit = null;
    for (const d of hane.digits) {
      const cx = (d.x * scaleX);
      const cy = (d.y * scaleY);
      const r = Math.max(2, (d.r || 10) * Math.min(scaleX, scaleY));
      const darkness = await getBubbleDarkness(imageBuffer, cx, cy, r, imgW, imgH);
      if (darkness < minDarkness) {
        minDarkness = darkness;
        selectedDigit = d.digit;
      }
    }
    // Boş hane: hiçbir balon yeterince koyu değilse (eşik ~200) o haneyi atlayabilir veya 0 sayabiliriz
    if (selectedDigit === null || minDarkness > 240) {
      return null; // Okunamadı
    }
    digits.push(String(selectedDigit));
  }

  const studentNumber = digits.join("");
  if (studentNumber.length !== 12) return null;
  return studentNumber;
}

export { readStudentNumberOMR, getBubbleDarkness };
