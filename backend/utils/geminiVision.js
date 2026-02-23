import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Initialize Gemini Vision API client
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Get Gemini model with fallback - tries models in order until one works
 */
function getGeminiModel(genAI) {
  // Model priority list (newest to oldest, most capable to least)
  const modelNames = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ];

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      console.log(`✅ Using Gemini model: ${modelName}`);
      return model;
    } catch (error) {
      console.warn(`⚠️ Model ${modelName} not available: ${error.message}`);
      continue;
    }
  }

  // If all models fail, throw error
  throw new Error(`None of the Gemini models are available. Tried: ${modelNames.join(", ")}`);
}

/**
 * Extract numeric value from an image using Gemini Vision API
 * @param {Buffer} imageBuffer - Image buffer (PNG)
 * @param {string} context - Context description (e.g., "student number digit", "exam code digit", "total score")
 * @returns {Promise<number>} Extracted number (0 if empty)
 */
async function extractNumberFromImage(imageBuffer, context = "numeric value") {
  try {
    const genAI = getGeminiClient();
    const model = getGeminiModel(genAI);

    // Convert buffer to base64
    const base64Image = imageBuffer.toString("base64");

    // Context-specific prompts
    let prompt;
    if (context === "total score") {
      prompt = `You are analyzing an exam paper image. This image shows a cropped section containing the TOTAL SCORE box.

CONTEXT:
- This is the TOTAL SCORE area from an exam paper
- The score box is located in the bottom-right corner of the exam paper
- The box may have black square markers (corners) or borders around it
- The actual score number is written INSIDE the marked/boxed area

INSTRUCTIONS:
1. Look for black square markers or rectangular borders - these are alignment markers, IGNORE them
2. Focus on the NUMBER written INSIDE the marked area (between or inside the markers)
3. The score is typically a 2-3 digit number (e.g., 85, 92, 100, 0)
4. The number may be handwritten or printed
5. Extract ONLY the numeric value - ignore markers, borders, labels, text, or any symbols
6. If the box is empty, no number visible, or only markers are present, return 0
7. Return ONLY the number digits, no explanations, no text, just the number

IMPORTANT:
- Markers are just visual guides - ignore them completely
- Only extract the actual score number inside the box
- If you see "85" written inside markers, return: 85
- If you see only markers and no number, return: 0

Example outputs: 85, 92, 100, 0

What is the total score number written inside the marked box?`;
    } else if (context.includes("student") || context.includes("digit")) {
      prompt = `You are analyzing a single digit box from an exam paper. This box contains ONE digit (0-9) that is part of a student number or exam code.

INSTRUCTIONS:
1. This is a small rectangular box containing a single handwritten or printed digit
2. The digit will be between 0 and 9
3. Look carefully for the number - it may be handwritten or printed
4. If the box is empty or unclear, return 0
5. Return ONLY the single digit number, no explanations

What digit (0-9) is in this box?`;
    } else {
      prompt = `Extract the numeric value from this image. 

INSTRUCTIONS:
1. Look for any number in the image
2. Return ONLY the numeric value
3. If empty or no number found, return 0
4. Do not include any explanation, text, or symbols - only the number

What number is in this image?`;
    }

    console.log(`🤖 Calling Gemini API to extract ${context} from image...`);
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/png",
        },
      },
    ]);

    const response = result.response;
    const text = response.text().trim();
    
    console.log(`🤖 Gemini API response: "${text}"`);

    // Parse the response
    if (!text || text === "" || text.toLowerCase() === "empty") {
      console.log("  → Parsed as: 0 (empty)");
      return 0;
    }

    // Extract first number from response
    const numberMatch = text.match(/\d+/);
    if (!numberMatch) {
      console.error(`  ❌ No number found in response: "${text}"`);
      throw new Error("Invalid score value detected.");
    }

    const number = parseInt(numberMatch[0], 10);
    if (isNaN(number)) {
      console.error(`  ❌ Invalid number parsed: "${numberMatch[0]}"`);
      throw new Error("Invalid score value detected.");
    }

    console.log(`  ✅ Parsed number: ${number}`);
    return number;
  } catch (error) {
    if (error.message.includes("GEMINI_API_KEY")) {
      throw error;
    }
    console.error(`  ❌ Gemini API error: ${error.message}`);
    throw new Error(`Gemini Vision API error: ${error.message}`);
  }
}

/**
 * Extract student id (numeric) from a full page image using Gemini Vision
 * @param {Buffer} imageBuffer - PNG buffer
 * @returns {Promise<string|null>} student number or null
 */
async function extractStudentIdFromImage(imageBuffer) {
  try {
    console.log("🤖 Calling Gemini API for full-page student number OCR...");
    const genAI = getGeminiClient();
    const model = getGeminiModel(genAI);
    const base64Image = imageBuffer.toString("base64");
    const prompt = `You are analyzing a full exam paper image. Your task is to find and extract the STUDENT ID NUMBER.

INSTRUCTIONS:
1. Look for a student ID number field - typically located in the top area of the exam paper
2. The student ID is usually a sequence of 7-12 digits (e.g., 20231021, 2023123456)
3. It may be written in boxes, circles, or a single text field
4. Ignore any labels, text, or symbols - extract ONLY the numeric digits
5. The number may be handwritten or printed
6. If you cannot find a clear student ID number, return EMPTY

IMPORTANT:
- Return ONLY the digits (no spaces, no dashes, no text)
- If not found or unclear, return exactly: EMPTY
- Example outputs: 20231021, 2023123456, EMPTY

What is the student ID number in this exam paper?`;
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/png",
        },
      },
    ]);
    const text = result.response.text().trim();
    console.log(`🤖 Gemini OCR response: "${text}"`);
    if (!text || text.toLowerCase() === "empty") {
      console.log("  → No student number found (EMPTY)");
      return null;
    }
    const match = text.match(/\d{5,12}/);
    if (match) {
      console.log(`  ✅ Extracted student number: ${match[0]}`);
      return match[0];
    } else {
      console.log(`  ❌ No valid student number pattern found in: "${text}"`);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Full-page OCR error: ${error.message}`);
    return null;
  }
}

/**
 * Extract student number from 10 digit boxes
 * @param {Array<Buffer>} digitBoxes - Array of 10 image buffers
 * @returns {Promise<string>} Student number string
 */
async function extractStudentNumber(digitBoxes) {
  console.log(`🔢 Extracting student number from ${digitBoxes.length} digit boxes...`);
  const digits = [];
  for (let i = 0; i < digitBoxes.length; i++) {
    console.log(`  Reading digit ${i + 1}/${digitBoxes.length}...`);
    const digit = await extractNumberFromImage(digitBoxes[i], "student number digit");
    digits.push(digit.toString());
    console.log(`  Digit ${i + 1}: ${digit}`);
  }
  const studentNumber = digits.join("");
  console.log(`✅ Extracted student number: ${studentNumber}`);
  return studentNumber;
}

/**
 * Extract full student number from a single box (tüm haneler tek kutuda)
 * @param {Buffer} imageBuffer - Single cropped image containing the full student number
 * @returns {Promise<string|null>} Student number string or null
 */
async function extractStudentNumberFromSingleBox(imageBuffer) {
  try {
    const genAI = getGeminiClient();
    const model = getGeminiModel(genAI);
    const base64Image = imageBuffer.toString("base64");
    const prompt = `You are analyzing a cropped image from an exam paper. This image shows ONE box that contains the FULL student number (all digits in a single box).

INSTRUCTIONS:
1. Extract the complete student number - all digits in one box (typically 7-12 digits, e.g. 20231021, 2023123456)
2. The number may be handwritten or printed
3. Return ONLY the digits, no spaces, no dashes, no labels
4. If the box is empty or no number is visible, return exactly: EMPTY

Return ONLY the digits or EMPTY.`;
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/png",
        },
      },
    ]);
    const text = result.response.text().trim();
    console.log(`🤖 Gemini single-box student number: "${text}"`);
    if (!text || text.toLowerCase() === "empty") return null;
    const match = text.replace(/\s/g, "").match(/\d{5,12}/);
    if (match) {
      console.log(`  ✅ Extracted student number: ${match[0]}`);
      return match[0];
    }
    return null;
  } catch (error) {
    console.error(`  ❌ extractStudentNumberFromSingleBox error: ${error.message}`);
    return null;
  }
}

/**
 * Extract exam ID from 2 digit boxes
 * @param {Array<Buffer>} digitBoxes - Array of 2 image buffers
 * @returns {Promise<string>} Exam ID string (2 digits)
 */
async function extractExamId(digitBoxes) {
  const digit1 = await extractNumberFromImage(digitBoxes[0], "exam code digit");
  const digit2 = await extractNumberFromImage(digitBoxes[1], "exam code digit");
  return `${digit1}${digit2}`;
}

/**
 * Extract scores from question score boxes
 * @param {Array<Buffer>} scoreBoxes - Array of score box image buffers
 * @returns {Promise<Array<number>>} Array of scores
 */
async function extractScores(scoreBoxes) {
  const scores = [];
  for (let i = 0; i < scoreBoxes.length; i++) {
    const score = await extractNumberFromImage(scoreBoxes[i]);
    // Clamp score between 0 and 100
    scores.push(Math.max(0, Math.min(100, score)));
  }
  return scores;
}

export {
  extractNumberFromImage,
  extractStudentNumber,
  extractStudentNumberFromSingleBox,
  extractExamId,
  extractScores,
  extractStudentIdFromImage,
};

