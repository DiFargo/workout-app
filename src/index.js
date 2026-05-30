// PERFORMANCE OPTIMIZED FOR LOW LATENCY
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const FATSECRET_CLIENT_ID = defineSecret("FATSECRET_CLIENT_ID");
const FATSECRET_CLIENT_SECRET = defineSecret("FATSECRET_CLIENT_SECRET");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const OFF_USER_AGENT = "WorkoutApp/1.0 (nutrition search; contact: work.kriptonit.il@gmail.com)";

let cachedToken = null;
let cachedTokenExpiresAt = 0;


let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY.value()
    });
  }

  return openaiClient;
}

function sendJson(res, status, payload) {
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(payload));
}

function parseNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function roundMacro(value) {
  const number = parseNumber(value);
  return Math.round(number * 10) / 10;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function parseFoodDescription(description = "") {
  const portionMatch = description.match(/^Per\s+(.+?)\s+-/i);
  const caloriesMatch = description.match(/Calories:\s*([\d.]+)\s*kcal/i);
  const fatMatch = description.match(/Fat:\s*([\d.]+)\s*g/i);
  const carbsMatch = description.match(/Carbs:\s*([\d.]+)\s*g/i);
  const proteinMatch = description.match(/Protein:\s*([\d.]+)\s*g/i);

  return {
    portion: portionMatch ? portionMatch[1].trim() : "100 г",
    calories: parseNumber(caloriesMatch?.[1]),
    fat: parseNumber(fatMatch?.[1]),
    carbs: parseNumber(carbsMatch?.[1]),
    protein: parseNumber(proteinMatch?.[1])
  };
}

function normalizeOffProduct(product = {}) {
  const nutriments = product.nutriments || {};
  const code = normalizeString(product.code || product._id);
  const productName = normalizeString(product.product_name || product.product_name_ru || product.product_name_en || product.generic_name);
  const brands = normalizeString(product.brands);

  if (!productName && !brands) return null;

  const calories100g = parseNumber(
    nutriments["energy-kcal_100g"] ??
      nutriments["energy-kcal"] ??
      (nutriments.energy_100g ? parseNumber(nutriments.energy_100g) / 4.184 : 0)
  );

  const protein100g = parseNumber(nutriments.proteins_100g ?? nutriments.proteins);
  const fat100g = parseNumber(nutriments.fat_100g ?? nutriments.fat);
  const carbs100g = parseNumber(nutriments.carbohydrates_100g ?? nutriments.carbohydrates);

  const hasUsefulNutrition = calories100g > 0 || protein100g > 0 || fat100g > 0 || carbs100g > 0;
  if (!hasUsefulNutrition) return null;

  const name = brands ? `${productName || "Продукт"} — ${brands}` : productName;
  const portion = normalizeString(product.serving_size || product.quantity || "100 г");

  return {
    id: `off_${code || Buffer.from(name).toString("base64url").slice(0, 18)}`,
    foodId: `off_${code || Buffer.from(name).toString("base64url").slice(0, 18)}`,
    openFoodFactsId: code,
    barcode: code,
    name,
    portion,
    calories: Math.round(calories100g),
    protein: roundMacro(protein100g),
    fat: roundMacro(fat100g),
    carbs: roundMacro(carbs100g),
    source: "Open Food Facts"
  };
}

async function fetchOpenFoodFactsFoods(query) {
  const q = normalizeString(query);
  if (q.length < 2) return [];

  const fields = [
    "code",
    "product_name",
    "product_name_ru",
    "product_name_en",
    "generic_name",
    "brands",
    "quantity",
    "serving_size",
    "nutriments"
  ].join(",");

  const barcode = q.replace(/\D/g, "");
  const results = [];

  if (barcode.length >= 8) {
    const barcodeUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${encodeURIComponent(fields)}`;
    const barcodeResponse = await fetch(barcodeUrl, {
      headers: { "User-Agent": OFF_USER_AGENT }
    });

    if (barcodeResponse.ok) {
      const data = await barcodeResponse.json();
      const food = data?.status === 1 ? normalizeOffProduct(data.product) : null;
      if (food) results.push(food);
    }
  }

  const searchUrl = new URL("https://world.openfoodfacts.org/api/v2/search");
  searchUrl.searchParams.set("search_terms", q);
  searchUrl.searchParams.set("page_size", "20");
  searchUrl.searchParams.set("fields", fields);

  const searchResponse = await fetch(searchUrl, {
    headers: { "User-Agent": OFF_USER_AGENT }
  });

  if (!searchResponse.ok) {
    const text = await searchResponse.text();
    throw new Error(`Open Food Facts search error ${searchResponse.status}: ${text}`);
  }

  const data = await searchResponse.json();
  const products = Array.isArray(data.products) ? data.products : [];
  for (const product of products) {
    const food = normalizeOffProduct(product);
    if (food) results.push(food);
  }

  const seen = new Set();
  return results.filter((food) => {
    const key = food.barcode || food.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

async function getFatSecretToken() {
  const now = Date.now();

  if (cachedToken && cachedTokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const clientId = FATSECRET_CLIENT_ID.value();
  const clientSecret = FATSECRET_CLIENT_SECRET.value();

  if (!clientId || !clientSecret) {
    throw new Error("FatSecret secrets are not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "basic"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FatSecret token error ${response.status}: ${text}`);
  }

  const data = await response.json();

  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + (Number(data.expires_in || 3600) * 1000);

  return cachedToken;
}

async function fetchFatSecretFoods(query) {
  const q = normalizeString(query);
  if (q.length < 2) return [];

  const token = await getFatSecretToken();

  const params = new URLSearchParams({
    method: "foods.search",
    search_expression: q,
    max_results: "20",
    format: "json"
  });

  const response = await fetch("https://platform.fatsecret.com/rest/server.api", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FatSecret search error ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (data?.error) {
    throw new Error(`FatSecret API error ${data.error.code}: ${data.error.message}`);
  }

  const rawFood = data?.foods?.food;
  const foodsArray = Array.isArray(rawFood) ? rawFood : rawFood ? [rawFood] : [];

  return foodsArray.map((food) => {
    const parsed = parseFoodDescription(food.food_description || "");

    return {
      id: `fatsecret_${food.food_id}`,
      foodId: `fatsecret_${food.food_id}`,
      fatSecretId: food.food_id,
      name: food.brand_name ? `${food.food_name} — ${food.brand_name}` : food.food_name,
      portion: parsed.portion,
      calories: Math.round(parsed.calories),
      protein: parsed.protein,
      fat: parsed.fat,
      carbs: parsed.carbs,
      source: "FatSecret"
    };
  });
}


async function fetchOpenAiNutritionFoods(query) {
  const q = normalizeString(query);
  if (q.length < 2) return [];

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Ты помогаешь искать еду для фитнес-приложения в Беларуси. " +
                "Пользователь ввёл запрос: " + JSON.stringify(q) + ". " +
                "Верни только JSON без markdown. Формат: " +
                "{\"foods\":[{\"name\":\"название\",\"brand\":\"бренд если уместно\",\"portion\":\"100 г\",\"calories\":0,\"protein\":0,\"fat\":0,\"carbs\":0,\"confidence\":\"high|medium|low\"}]}. " +
                "Дай 6-10 реалистичных вариантов. Для обычных продуктов используй типичные значения на 100 г. " +
                "Для брендов Беларуси/СНГ, если точных данных не знаешь, ставь confidence medium или low. " +
                "Не выдумывай штрихкоды. Названия делай на русском, если запрос на русском."
            }
          ]
        }
      ],
      max_output_tokens: 900
    })
  });

  if (!openAiResponse.ok) {
    const text = await openAiResponse.text();
    throw new Error(`OpenAI nutrition search error ${openAiResponse.status}: ${text}`);
  }

  const data = await openAiResponse.json();
  const outputText = data.output_text ||
    data.output?.flatMap((item) => item.content || [])
      ?.map((item) => item.text || "")
      ?.join("\n") || "";

  const parsed = extractJsonObject(outputText) || {};
  const rawFoods = Array.isArray(parsed.foods) ? parsed.foods : [];

  return rawFoods
    .map((food, index) => {
      const name = normalizeString(food.name || food.query);
      const brand = normalizeString(food.brand);
      const portion = normalizeString(food.portion || "100 г");

      if (!name) return null;

      const calories = Math.round(parseNumber(food.calories));
      const protein = roundMacro(food.protein);
      const fat = roundMacro(food.fat);
      const carbs = roundMacro(food.carbs);

      if (!calories && !protein && !fat && !carbs) return null;

      return {
        id: `ai_search_${Buffer.from(`${name}_${brand}_${index}`).toString("base64url").slice(0, 18)}`,
        foodId: `ai_search_${Buffer.from(`${name}_${brand}_${index}`).toString("base64url").slice(0, 18)}`,
        name: brand ? `${name} — ${brand}` : name,
        portion,
        calories,
        protein,
        fat,
        carbs,
        confidence: normalizeString(food.confidence || "medium"),
        source: "OpenAI"
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

async function nutritionSearchHandler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const q = normalizeString(req.query.q);
    if (q.length < 2) {
      res.json({ foods: [], sources: [] });
      return;
    }

    let foods = [];
    const warnings = [];

    try {
      foods = await fetchOpenAiNutritionFoods(q);
    } catch (error) {
      console.error("OpenAI nutrition search failed:", error);
      warnings.push("openai_failed");
    }

    const fallbackSuggestions =
      foods.length === 0
        ? [
            "Попробуй фото продукта",
            "Уточни запрос: бренд + продукт",
            "Создать продукт"
          ]
        : [];

    res.json({
      foods,
      fallbackSuggestions,
      sources: foods.length ? ["OpenAI"] : [],
      warnings,
      mode: "openai"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "nutrition_search_failed",
      message: error.message
    });
  }
}

exports.nutritionSearch = onRequest(
  {
    cors: true,
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 120,
    memory: "1GiB",
    minInstances: 1,
    concurrency: 20,
    region: "us-central1"
  },
  nutritionSearchHandler
);

// Backward compatibility with the old React endpoint /api/fatsecret/search.
exports.fatsecretSearch = onRequest(
  {
    cors: true,
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 120,
    memory: "1GiB",
    minInstances: 1,
    concurrency: 20,
    region: "us-central1"
  },
  nutritionSearchHandler
);

exports.openFoodFactsSearch = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: "512MiB",
    minInstances: 1,
    concurrency: 10,
    region: "us-central1"
  },
  async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      const q = normalizeString(req.query.q);
      const foods = await fetchOpenFoodFactsFoods(q);
      res.json({ foods, sources: foods.length ? ["Open Food Facts"] : [] });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "open_food_facts_search_failed",
        message: error.message
      });
    }
  }
);

function extractJsonObject(text = "") {
  const cleaned = String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  }
}

function normalizeAiFood(value = {}) {
  const name = normalizeString(value.name || value.query);
  const brand = normalizeString(value.brand || value.description);
  const portion = normalizeString(value.portion || "100 г");
  const calories = Math.round(parseNumber(value.calories));
  const protein = roundMacro(value.protein);
  const fat = roundMacro(value.fat);
  const carbs = roundMacro(value.carbs);

  if (!name || (!calories && !protein && !fat && !carbs)) return null;

  return {
    id: `ai_${Date.now()}`,
    foodId: `ai_${Date.now()}`,
    name: brand ? `${name} — ${brand}` : name,
    portion,
    calories,
    protein,
    fat,
    carbs,
    barcode: value.barcode ? String(value.barcode) : "",
    source: "AI Photo"
  };
}

exports.aiFoodPhoto = onRequest(
  {
    cors: true,
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 120,
    memory: "1GiB",
    minInstances: 1,
    concurrency: 20,
    region: "us-central1"
  },
  async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "method_not_allowed" });
        return;
      }

      const imageDataUrl = normalizeString(req.body?.imageDataUrl || req.body?.imageData);
      const mimeType = normalizeString(req.body?.mimeType || "image/jpeg");

      if (!imageDataUrl) {
        res.status(400).json({ error: "image_required", message: "Image data is required" });
        return;
      }

      const dataUrl = imageDataUrl.startsWith("data:") ? imageDataUrl : `data:${mimeType};base64,${imageDataUrl}`;

      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "Ты распознаёшь еду по фото для фитнес-приложения в Беларуси. " +
                    "Верни только JSON без markdown. Формат: " +
                    "{\"query\":\"название для поиска в Open Food Facts/FatSecret\",\"food\":{\"name\":\"название продукта\",\"brand\":\"бренд если виден\",\"portion\":\"100 г\",\"calories\":0,\"protein\":0,\"fat\":0,\"carbs\":0,\"barcode\":\"штрихкод если виден\"}}. " +
                    "Если видишь белорусский/европейский продукт, обязательно распознай бренд и название. " +
                    "Если точные калории/БЖУ не видны на упаковке, поставь 0 и дай хороший query. " +
                    "Если виден штрихкод, верни его в barcode."
                },
                {
                  type: "input_image",
                  image_url: dataUrl
                }
              ]
            }
          ],
          max_output_tokens: 500
        })
      });

      if (!openAiResponse.ok) {
        const text = await openAiResponse.text();
        throw new Error(`OpenAI error ${openAiResponse.status}: ${text}`);
      }

      const data = await openAiResponse.json();
      const outputText = data.output_text ||
        data.output?.flatMap((item) => item.content || [])
          ?.map((item) => item.text || "")
          ?.join("\n") || "";

      const parsed = extractJsonObject(outputText) || {};
      const rawFood = parsed.food || parsed;
      const barcode = normalizeString(parsed.barcode || rawFood.barcode);
      const query = normalizeString(barcode || parsed.query || rawFood.name || parsed.name);
      const food = normalizeAiFood(rawFood);

      res.json({
        query,
        name: query,
        barcode,
        food: food && food.name ? food : null,
        raw: parsed
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "ai_food_photo_failed",
        message: error.message
      });
    }
  }
);
