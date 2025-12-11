import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";

/**
 * Projede tercih edilen model isimleri
 * Buraya sadece gerçekten var olan / modern modelleri yazıyoruz.
 * Test sonuçlarına göre çalışan modeller:
 * - gemini-2.5-flash ✅
 * - gemini-2.5-pro ✅
 * - gemini-2.0-flash ✅
 * - gemini-2.0-flash-001 ✅
 * - gemini-2.5-flash-lite ✅
 */
const PREFERRED_MODELS = [
  "gemini-2.5-flash",        // En yeni ve hızlı model ✅
  "gemini-2.5-pro",          // En güçlü model ✅
  "gemini-2.0-flash",        // Alternatif hızlı model ✅
  "gemini-2.0-flash-001",    // Alternatif hızlı model ✅
  "gemini-2.5-flash-lite",   // Lite versiyon ✅
  // Eski modeller (fallback - genellikle çalışmıyor)
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

/**
 * Initialize Gemini Vision API client
 */
function getGeminiClient() {
  // GOOGLE_API_KEY fallback'i eklendi
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY / GOOGLE_API_KEY bulunamadı!");
    console.error("💡 .env dosyasında şu şekilde tanımlayın:");
    console.error("   GEMINI_API_KEY=AIzaSy...");
    console.error("   veya");
    console.error("   GOOGLE_API_KEY=AIzaSy...");
    console.error("   (Tırnak kullanmayın, sadece değeri yazın)");
    throw new Error("GEMINI_API_KEY / GOOGLE_API_KEY is not configured");
  }

  // API key'deki boşlukları temizle (yanlışlıkla tırnak içinde yazılmış olabilir)
  const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, "");

  if (cleanApiKey !== apiKey) {
    console.warn("⚠️ API key'de tırnak işareti tespit edildi, temizlendi.");
  }

  // API key formatını kontrol et
  if (cleanApiKey.length < 20) {
    console.error(
      `❌ API key çok kısa (${cleanApiKey.length} karakter). En az 20 karakter olmalı.`
    );
    throw new Error("API key çok kısa");
  }

  // API key'in başında "AIza" olmalı (Google API key formatı)
  if (!cleanApiKey.startsWith("AIza")) {
    console.error(`❌ API key formatı yanlış!`);
    console.error(
      `   API key 'AIza' ile başlamalı. Şu anki başlangıç: "${cleanApiKey.substring(
        0,
        4
      )}"`
    );
    console.error(
      `   Google AI Studio'dan yeni bir API key alın: https://aistudio.google.com/app/apikey`
    );
    throw new Error("API key formatı yanlış");
  }

  console.log(
    `✅ API key bulundu (${cleanApiKey.length} karakter, ${cleanApiKey.substring(
      0,
      10
    )}...)`
  );

  return new GoogleGenerativeAI(cleanApiKey);
}

/**
 * (Opsiyonel) Tüm modelleri listeleyip log'lar – debugging için.
 */
export async function listGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("❌ Model listesi için API key bulunamadı");
    return { models: [], error: "API key bulunamadı" };
  }

  const cleanApiKey = apiKey.trim().replace(/^["']|["']$/g, "");
  const results = { models: [], errors: [] };

  // Hem v1 hem v1beta API versiyonlarını dene
  const apiVersions = ["v1", "v1beta"];
  
  for (const version of apiVersions) {
    try {
      const url = `https://generativelanguage.googleapis.com/${version}/models?key=${cleanApiKey}`;
      console.log(`🔍 ${version} API versiyonunu kontrol ediyor...`);
      
      const res = await fetch(url);
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ ${version} ListModels hatası: ${res.status} ${errorText.substring(0, 200)}`);
        results.errors.push({ version, status: res.status, error: errorText.substring(0, 200) });
        continue;
      }
      
      const data = await res.json();
      console.log(`✅ ${version} API versiyonunda ${data.models?.length || 0} model bulundu:`);
      
      if (data.models && data.models.length > 0) {
        for (const m of data.models) {
          const modelName = m.name || m.displayName;
          console.log(`   - ${modelName}`);
          results.models.push({
            name: modelName,
            displayName: m.displayName,
            version: version,
            supportedMethods: m.supportedGenerationMethods || []
          });
        }
        return results; // İlk başarılı sonucu döndür
      }
    } catch (e) {
      console.error(`❌ ${version} ListModels isteği başarısız:`, e?.message || e);
      results.errors.push({ version, error: e?.message || String(e) });
    }
  }
  
  return results;
}

/**
 * Test API key and list available models
 * Bu fonksiyon API key'in çalışıp çalışmadığını test eder
 */
export async function testGeminiAPI() {
  const results = {
    apiKeyFound: false,
    apiKeyFormat: "unknown",
    testedModels: [],
    workingModel: null,
    errors: [],
  };

  try {
    // Önce mevcut modelleri listele
    const modelList = await listGeminiModels();
    const availableModelNames = modelList.models?.map(m => m.name) || [];
    
    // Eğer mevcut modeller varsa, onları da test listesine ekle
    const modelsToTest = [...PREFERRED_MODELS];
    if (availableModelNames.length > 0) {
      console.log(`📋 API'den ${availableModelNames.length} model bulundu, bunlar da test edilecek`);
      for (const modelName of availableModelNames) {
        // Model adı "models/" ile başlıyorsa kaldır
        const cleanName = modelName.replace(/^models\//, '');
        if (!modelsToTest.includes(cleanName)) {
          modelsToTest.push(cleanName);
        }
      }
    }
    
    const genAI = getGeminiClient();
    results.apiKeyFound = true;
    results.apiKeyFormat = "valid";

    console.log("🔍 Gemini modellerini test ediyor...");
    console.log(`📋 ${modelsToTest.length} model test edilecek`);

    for (const modelName of modelsToTest) {
      try {
        console.log(`   🧪 "${modelName}" test ediliyor...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        // Basit bir test çağrısı yap (sadece metin, görüntü olmadan)
        const result = await model.generateContent("Basit bir test cümlesi.");
        const response = result.response;
        const text = (await response.text()).substring(0, 50);

        console.log(
          `   ✅ Model "${modelName}" çalışıyor! Yanıt: "${text}..."`
        );

        results.testedModels.push({
          name: modelName,
          status: "working",
          response: text,
        });

        if (!results.workingModel) {
          results.workingModel = modelName;
        }
      } catch (error) {
        const errorMsg = error?.message || String(error);
        const shortError = errorMsg.substring(0, 200);

        console.log(
          `   ❌ Model "${modelName}" çalışmıyor: ${shortError}`
        );

        results.testedModels.push({
          name: modelName,
          status: "failed",
          error: shortError,
        });

        results.errors.push({
          model: modelName,
          error: shortError,
        });

        continue;
      }
    }

    if (!results.workingModel) {
      console.error("❌ Hiçbir model çalışmıyor!");
      console.error("💡 Olası nedenler:");
      console.error("   1. API key yanlış veya geçersiz");
      console.error("   2. API key'in Gemini API erişimi yok");
      console.error("   3. Google AI Studio'da API key'in aktif olması gerekiyor");
      console.error(
        "   4. API key'in oluşturulmasından sonra birkaç dakika beklemeniz gerekebilir"
      );

      return {
        success: false,
        error: "Hiçbir model çalışmıyor",
        details: results,
      };
    }

    return {
      success: true,
      workingModel: results.workingModel,
      details: results,
      };
  } catch (error) {
    const errorMsg = error?.message || String(error);
    console.error("❌ Gemini API test hatası:", errorMsg);

    results.errors.push({
      general: errorMsg,
    });

    return {
      success: false,
      error: errorMsg,
      details: results,
    };
  }
}

/**
 * Extract numeric value from an image using Gemini Vision API
 * @param {Buffer} imageBuffer - Image buffer (PNG)
 * @returns {Promise<number>} Extracted number (0 if empty)
 */
async function extractNumberFromImage(imageBuffer) {
  const genAI = getGeminiClient();

  // Convert buffer to base64
  const base64Image = imageBuffer.toString("base64");

  // Görüntü boyutunu kontrol et
  const imageMetadata = await sharp(imageBuffer).metadata().catch(() => null);
  if (imageMetadata) {
    console.log(
      `   📷 Görüntü boyutu: ${imageMetadata.width}x${imageMetadata.height}px`
    );

    // Görüntü çok küçükse uyarı ver
    if ((imageMetadata.width || 0) < 50 || (imageMetadata.height || 0) < 50) {
      console.warn(
        `   ⚠️ Görüntü çok küçük! Bu, template koordinatlarının yanlış olabileceğini gösterir.`
      );
    }
  }

     let lastError = null;

  // Tercih edilen modelleri sırayla dene
  for (const modelName of PREFERRED_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt =
        "Extract the numeric value inside this box. Only return a single number. If empty, return 0. Do not include any explanation or text, only the number.";

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
      const text = (await response.text()).trim();

      console.log(`   🤖 Gemini yanıtı (${modelName}): "${text}"`);

      // Parse the response
      if (!text || text === "" || text.toLowerCase() === "empty") {
        console.log(`   ⚠️ Boş görüntü tespit edildi, 0 döndürülüyor`);
        return 0;
      }

      // Extract first number from response
      const numberMatch = text.match(/\d+/);
      if (!numberMatch) {
        console.error(
          `   ❌ Geçersiz yanıt: "${text}" - sayı bulunamadı`
        );
        throw new Error(
          `Invalid score value detected. Gemini response: "${text}"`
        );
      }

      const number = parseInt(numberMatch[0], 10);
      if (isNaN(number)) {
        console.error(`   ❌ Geçersiz sayı: "${numberMatch[0]}"`);
        throw new Error(
          `Invalid score value detected. Parsed value: "${numberMatch[0]}"`
        );
      }

      return number;
    } catch (error) {
      const msg = error?.message || String(error);

      // Model bulunamadı hatası ise bir sonraki modeli dene
      if (
        msg.includes("not found") ||
        msg.includes("404") ||
        msg.includes("is not found")
      ) {
        console.warn(
          `   ⚠️ Model "${modelName}" bulunamadı, bir sonraki model deneniyor...`
        );
        lastError = error;
        continue;
      }

      // API key hatası ise özel mesaj ver
      if (
        msg.includes("API_KEY") ||
        msg.includes("401") ||
        msg.includes("403")
      ) {
        console.error(
          `   ❌ Gemini API key hatası! Lütfen .env dosyasındaki GEMINI_API_KEY / GOOGLE_API_KEY'i kontrol edin.`
        );
        throw new Error(
          `Gemini API key hatası: ${msg}. Lütfen .env dosyasındaki GEMINI_API_KEY / GOOGLE_API_KEY'i kontrol edin.`
        );
      }

      // Diğer hatalar için fırlat
      throw error;
    }
  }

  // Tüm modeller denendi ama hiçbiri çalışmadı
  console.error(`   ❌ Tüm Gemini modelleri denendi ama hiçbiri çalışmadı!`);
  console.error(`   💡 İpuçları:`);
  console.error(`      - API key'in doğru olduğundan emin olun`);
  console.error(`      - API key'in aktif olduğunu kontrol edin`);
  console.error(`      - Google AI Studio'dan yeni bir API key almayı deneyin`);
  throw new Error(
    `Tüm Gemini modelleri denendi ama hiçbiri çalışmadı. Son hata: ${
      lastError?.message || "Bilinmeyen hata"
    }`
  );
}

/**
 * Extract student id (numeric) from a full page image using Gemini Vision
 * @param {Buffer} imageBuffer - PNG buffer
 * @returns {Promise<string|null>} student number or null
 */
async function extractStudentIdFromImage(imageBuffer) {
  try {
    const genAI = getGeminiClient();
    const base64Image = imageBuffer.toString("base64");

    let lastError = null;

    for (const modelName of PREFERRED_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt =
          "Extract ONLY the student ID number from this exam paper. Return just the digits without spaces or text. If not found, return EMPTY.";

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/png",
            },
          },
        ]);

        const text = (await result.response.text()).trim();
        console.log(
          `   🤖 Student ID yanıtı (${modelName}): "${text}"`
        );

        if (!text || text.toLowerCase() === "empty") return null;

        const match = text.match(/\d{5,12}/);
        return match ? match[0] : null;
      } catch (error) {
        const msg = error?.message || String(error);

        if (
          msg.includes("not found") ||
          msg.includes("404") ||
          msg.includes("is not found")
        ) {
          console.warn(
            `   ⚠️ Model "${modelName}" bulunamadı, bir sonraki model deneniyor...`
          );
          lastError = error;
          continue;
        }

        if (
          msg.includes("API_KEY") ||
          msg.includes("401") ||
          msg.includes("403")
        ) {
          console.error(
            `   ❌ Gemini API key hatası! Lütfen .env dosyasındaki GEMINI_API_KEY / GOOGLE_API_KEY'i kontrol edin.`
          );
          throw new Error(
            `Gemini API key hatası: ${msg}. Lütfen .env dosyasındaki GEMINI_API_KEY / GOOGLE_API_KEY'i kontrol edin.`
          );
        }

        lastError = error;
      }
    }

    console.error(
      `   ❌ Student ID için tüm modeller denendi ama hiçbiri çalışmadı.`
    );
    console.error(
      `      Son hata: ${lastError?.message || "bilinmeyen hata"}`
    );
    return null;
  } catch (error) {
    console.error("❌ extractStudentIdFromImage hatası:", error);
    return null;
  }
}

/**
 * Extract student number from 10 digit boxes
 * @param {Array<Buffer>} digitBoxes - Array of 10 image buffers
 * @returns {Promise<string>} Student number string
 */
async function extractStudentNumber(digitBoxes) {
  const digits = [];
  for (let i = 0; i < digitBoxes.length; i++) {
    const digit = await extractNumberFromImage(digitBoxes[i]);
    digits.push(digit.toString());
  }
  return digits.join("");
}

/**
 * Extract exam ID from 2 digit boxes
 * @param {Array<Buffer>} digitBoxes - Array of 2 image buffers
 * @returns {Promise<string>} Exam ID string (2 digits)
 */
async function extractExamId(digitBoxes) {
  const digit1 = await extractNumberFromImage(digitBoxes[0]);
  const digit2 = await extractNumberFromImage(digitBoxes[1]);
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
  extractExamId,
  extractScores,
  extractStudentIdFromImage,
};
