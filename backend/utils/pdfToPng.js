import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert PDF to PNG using pdf-poppler or pdftoppm
 * @param {Buffer|string} pdfInput - PDF buffer or file path
 * @returns {Promise<{ buffer: Buffer; filePath: string }>} PNG buffer & temp path
 */
async function pdfToPng(pdfInput) {
  try {
    // Check if pdf-poppler is available, otherwise use pdftoppm
    let tempPdfPath;
    let isTempFile = false;

    // If input is buffer, save to temp file
    if (Buffer.isBuffer(pdfInput)) {
      tempPdfPath = path.join(__dirname, "../temp", `temp_${Date.now()}.pdf`);
      const tempDir = path.dirname(tempPdfPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      fs.writeFileSync(tempPdfPath, pdfInput);
      isTempFile = true;
    } else {
      tempPdfPath = pdfInput;
    }

    // Check if pdf-poppler is enabled (it requires native binaries)
    const ENABLE_PDF_POPPLER = process.env.ENABLE_PDF_POPPLER !== "false";
    
    // Try using pdf-poppler first (if enabled)
    if (ENABLE_PDF_POPPLER) {
      try {
        const pdfPopplerModule = await import("pdf-poppler");
        const pdfPoppler = pdfPopplerModule.default || pdfPopplerModule;
        const options = {
          format: "png",
          out_dir: path.join(__dirname, "../temp"),
          out_prefix: `page_${Date.now()}`,
          page: 1,
        };

        await pdfPoppler.convert(tempPdfPath, options);

        const pngPath = path.join(
          options.out_dir,
          `${options.out_prefix}-1.png`
        );
        const pngBuffer = fs.readFileSync(pngPath);

        // Temizlik: PDF'yi temizle ama PNG'yi sakla (path döndürülüyor)
        if (isTempFile && fs.existsSync(tempPdfPath)) {
          fs.unlinkSync(tempPdfPath);
        }

        return { buffer: pngBuffer, filePath: pngPath };
      } catch (popplerError) {
        // Fall through to pdftoppm fallback
        console.warn("⚠️ pdf-poppler failed, falling back to pdftoppm:", popplerError.message);
      }
    }
    
    // Fallback to pdftoppm (poppler-utils) - this should work on Linux
    const outputPath = path.join(
      process.cwd(),
      "temp",
      `output_${Date.now()}.png`
    );
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      execSync(
        `pdftoppm -png -f 1 -l 1 "${tempPdfPath}" "${outputPath.replace('.png', '')}"`,
        { stdio: "ignore" }
      );

      const pngFiles = fs
        .readdirSync(outputDir)
        .filter((f) => f.startsWith(path.basename(outputPath, ".png")) && f.endsWith(".png"));

      if (pngFiles.length === 0) {
        throw new Error("No PNG output generated");
      }

      const generatedPng = path.join(outputDir, pngFiles[0]);
      const pngBuffer = fs.readFileSync(generatedPng);

      // Temizlik: PDF'yi temizle ama PNG'yi sakla (path döndürülüyor)
      if (isTempFile && fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }

      return { buffer: pngBuffer, filePath: generatedPng };
    } catch (pdftoppmError) {
      // Cleanup on error
      if (isTempFile && fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
      throw new Error(
        "PDF to PNG conversion failed. Please install pdf-poppler or poppler-utils."
      );
    }
  } catch (error) {
    throw new Error(`PDF to PNG conversion error: ${error.message}`);
  }
}

/**
 * Convert all pages of a PDF to PNG (her sayfa = bir öğrenci kağıdı için).
 * @param {Buffer|string} pdfInput - PDF buffer or file path
 * @returns {Promise<{ buffers: Buffer[]; filePaths: string[] }>} Her sayfa için PNG buffer ve path dizisi
 */
async function pdfToPngAllPages(pdfInput) {
  let tempPdfPath;
  let isTempFile = false;

  if (Buffer.isBuffer(pdfInput)) {
    tempPdfPath = path.join(__dirname, "../temp", `temp_multipage_${Date.now()}.pdf`);
    const tempDir = path.dirname(tempPdfPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(tempPdfPath, pdfInput);
    isTempFile = true;
  } else {
    tempPdfPath = pdfInput;
  }

  const outputDir = path.join(process.cwd(), "temp");
  const prefix = `multipage_${Date.now()}`;
  const outputPrefix = path.join(outputDir, prefix);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // pdftoppm: -f 1 -l 999 tüm sayfaları çıkarır; prefix-1.png, prefix-2.png, ...
    execSync(
      `pdftoppm -png -r 150 -f 1 -l 999 "${tempPdfPath}" "${outputPrefix}"`,
      { stdio: "ignore" }
    );

    const allFiles = fs.readdirSync(outputDir)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".png"));

    // Sıralama: prefix-1.png, prefix-2.png, ... (sayıya göre)
    const sortKey = (f) => {
      const base = f.replace(prefix, "").replace(".png", "").replace("-", "");
      return parseInt(base, 10) || 0;
    };
    const sorted = allFiles.sort((a, b) => sortKey(a) - sortKey(b));

    const buffers = [];
    const filePaths = [];
    for (const f of sorted) {
      const fullPath = path.join(outputDir, f);
      buffers.push(fs.readFileSync(fullPath));
      filePaths.push(fullPath);
      try {
        fs.unlinkSync(fullPath);
      } catch (_) {}
    }

    if (isTempFile && fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
    }

    return { buffers, filePaths };
  } catch (err) {
    if (isTempFile && fs.existsSync(tempPdfPath)) {
      try { fs.unlinkSync(tempPdfPath); } catch (_) {}
    }
    throw new Error(`PDF to PNG (all pages) failed: ${err.message}. Install poppler-utils (pdftoppm).`);
  }
}

export { pdfToPng, pdfToPngAllPages };

