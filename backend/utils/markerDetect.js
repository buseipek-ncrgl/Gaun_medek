import sharp from "sharp";

// Try to load OpenCV at module level
let cv = null;
try {
  const cvModule = await import("opencv4nodejs").catch(() => null);
  cv = cvModule?.default || cvModule || null;
  if (cv) {
    global.cv = cv; // Store in global for consistency
  }
} catch (error) {
  cv = null;
}

/**
 * Detect 4 black square markers in the exam template
 * @param {Buffer} imageBuffer - PNG image buffer
 * @returns {Promise<Object>} Marker coordinates
 */
export async function detectMarkers(imageBuffer) {
  try {
    if (!global.cv && !cv) {
      throw new Error("OpenCV not available");
    }

    const opencv = global.cv || cv;

    // Convert buffer to OpenCV Mat
    const image = opencv.imdecode(imageBuffer);

    // Convert to grayscale
    const gray = image.bgrToGray();

    // Apply threshold to isolate black squares
    const threshold = gray.threshold(127, 255, opencv.THRESH_BINARY_INV);

    // Find contours
    const contours = threshold.findContours(
      opencv.RETR_EXTERNAL,
      opencv.CHAIN_APPROX_SIMPLE
    );

    // Filter contours by shape and size
    const markers = [];
    const minArea = 1600; // ~40x40px minimum
    const maxArea = 3600; // ~60x60px maximum
    const aspectRatioTolerance = 0.2; // Allow some variance in square shape

    for (let i = 0; i < contours.length; i++) {
      const contour = contours[i];
      const area = contour.area;
      const rect = contour.boundingRect();

      // Check area
      if (area < minArea || area > maxArea) continue;

      // Check aspect ratio (should be close to 1 for squares)
      const aspectRatio = rect.width / rect.height;
      if (Math.abs(aspectRatio - 1) > aspectRatioTolerance) continue;

      // Calculate center
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      markers.push({
        x: centerX,
        y: centerY,
        width: rect.width,
        height: rect.height,
      });
    }

    if (markers.length < 4) {
      throw new Error(
        "Template markers not found. Please upload the correct exam template."
      );
    }

    // Sort markers to identify corners
    const sortedBySum = [...markers].sort((a, b) => a.x + a.y - (b.x + b.y));
    const topLeft = sortedBySum[0];

    const sortedByXDesc = [...markers].sort((a, b) => b.x - a.x || a.y - b.y);
    const topRight = sortedByXDesc[0];

    const sortedByXAsc = [...markers].sort((a, b) => a.x - b.x || b.y - a.y);
    const bottomLeft = sortedByXAsc[0];

    const sortedBySumDesc = [...markers].sort(
      (a, b) => b.x + b.y - (a.x + a.y)
    );
    const bottomRight = sortedBySumDesc[0];

    return {
      success: true,
      topLeft: { x: topLeft.x, y: topLeft.y },
      topRight: { x: topRight.x, y: topRight.y },
      bottomLeft: { x: bottomLeft.x, y: bottomLeft.y },
      bottomRight: { x: bottomRight.x, y: bottomRight.y },
    };
  } catch (err) {
    const reason = err.message.includes("OpenCV not available") 
      ? "opencv_missing" 
      : "markers_not_found";
    
    if (reason === "opencv_missing") {
      console.warn("⚠️  OpenCV yüklü değil. Marker detection kullanılamıyor, şablon modu aktif.");
    } else {
      console.warn("⚠️  Marker bulunamadı:", err.message, "- Şablon modu kullanılıyor.");
    }
    
    return {
      success: false,
      reason,
      markers: [],
      message: reason === "opencv_missing" 
        ? "OpenCV yüklü değil, şablon modunda işleniyor"
        : "Marker bulunamadı, şablon modunda işleniyor"
    };
  }
}
