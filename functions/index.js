import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import crypto from "node:crypto";

admin.initializeApp();



const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const ADMIN_BOOTSTRAP_SECRET = defineSecret("ADMIN_BOOTSTRAP_SECRET");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

function json(res, status, payload) {
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(payload));
}

function normalizeTelegramTarget({ chatId, telegramUserId, username }) {
  const directChatId = String(chatId || "").trim();
  const userId = String(telegramUserId || "").trim();
  const cleanUsername = String(username || "").replace(/^@/, "").trim();

  return directChatId || userId || (cleanUsername ? `@${cleanUsername}` : "");
}

async function sendTelegramMessage({ chatId, telegramUserId, username, text, token }) {
  const targetChatId = normalizeTelegramTarget({ chatId, telegramUserId, username });

  if (!targetChatId) {
    throw new Error("Missing Telegram target");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || "Telegram API error");
  }

  return data;
}

async function getTelegramAvatarUrl(userId, token) {
  if (!userId) return "";

  try {
    const photosResponse = await fetch(`https://api.telegram.org/bot${token}/getUserProfilePhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, limit: 1 })
    });

    const photosData = await photosResponse.json();

    if (!photosData.ok || !photosData.result?.photos?.length) return "";

    const bestPhoto = photosData.result.photos[0].at(-1);
    const fileId = bestPhoto?.file_id;

    if (!fileId) return "";

    const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const fileData = await fileResponse.json();

    if (!fileData.ok || !fileData.result?.file_path) return "";

    return `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
  } catch (error) {
    console.error("Telegram avatar fetch failed:", error);
    return "";
  }
}

function verifyTelegramLoginPayload(payload = {}, token) {
  const { hash, ...data } = payload;

  if (!hash) return false;

  const authDate = Number(data.auth_date || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!authDate || Math.abs(now - authDate) > 24 * 60 * 60) {
    return false;
  }

  const dataCheckString = Object.keys(data)
    .filter((key) => data[key] !== undefined && data[key] !== null && data[key] !== "")
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(token).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(hash));
  } catch (_) {
    return false;
  }
}



function assertAdmin(request) {
  if (!request.auth?.token?.admin) {
    throw new HttpsError("permission-denied", "Only admin can perform this action.");
  }
}

export const setAdminClaim = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30
  },
  async (request) => {
    assertAdmin(request);

    const uid = String(request.data?.uid || "").trim();
    const adminClaim = Boolean(request.data?.admin);

    if (!uid) {
      throw new HttpsError("invalid-argument", "uid is required.");
    }

    await admin.auth().setCustomUserClaims(uid, {
      admin: adminClaim
    });

    await admin.firestore().collection("users").doc(uid).set({
      role: adminClaim ? "admin" : "client",
      adminClaimUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return {
      ok: true,
      uid,
      admin: adminClaim
    };
  }
);

export const bootstrapFirstAdmin = onCall(
  {
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [ADMIN_BOOTSTRAP_SECRET]
  },
  async (request) => {
    const email = String(request.data?.email || "").trim().toLowerCase();
    const bootstrapSecret = String(request.data?.bootstrapSecret || "");

    const expectedSecret = ADMIN_BOOTSTRAP_SECRET.value();

    if (!expectedSecret || bootstrapSecret !== expectedSecret) {
      throw new HttpsError("permission-denied", "Invalid bootstrap secret.");
    }

    if (!email) {
      throw new HttpsError("invalid-argument", "email is required.");
    }

    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true
    });

    await admin.firestore().collection("users").doc(user.uid).set({
      role: "admin",
      adminClaimUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return {
      ok: true,
      uid: user.uid,
      email,
      admin: true
    };
  }
);


export const telegramLoginVerify = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const { uid, telegramUser } = req.body || {};
      if (!uid || !telegramUser) return json(res, 400, { ok: false, error: "Missing uid or telegramUser" });

      const token = TELEGRAM_BOT_TOKEN.value();
      if (!verifyTelegramLoginPayload(telegramUser, token)) {
        return json(res, 401, { ok: false, error: "Invalid Telegram signature" });
      }

      const avatarUrl = await getTelegramAvatarUrl(telegramUser.id, token);

      const telegramProfile = {
        connected: true,
        chatId: "",
        telegramUserId: String(telegramUser.id || ""),
        username: telegramUser.username || "",
        displayName: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || telegramUser.username || "",
        firstName: telegramUser.first_name || "",
        lastName: telegramUser.last_name || "",
        photoUrl: telegramUser.photo_url || "",
        avatarUrl: avatarUrl || telegramUser.photo_url || "",
        notificationsEnabled: true,
        loginAuthDate: telegramUser.auth_date || "",
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        loginProvider: "telegram_login_widget"
      };

      await admin.firestore().collection("users").doc(uid).set({
        telegram: telegramProfile,
        telegramConnected: true,
        telegramUsername: telegramProfile.username,
        telegramDisplayName: telegramProfile.displayName,
        telegramAvatarUrl: telegramProfile.avatarUrl,
        telegramUserId: telegramProfile.telegramUserId,
        telegramNotificationsEnabled: true,
        telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return json(res, 200, { ok: true, telegram: telegramProfile });
    } catch (error) {
      console.error("telegramLoginVerify error:", error);
      return json(res, 500, { ok: false, error: error.message });
    }
  }
);

export const telegramSendMessage = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const { clientId, username, chatId, telegramUserId, text } = req.body || {};
      const token = TELEGRAM_BOT_TOKEN.value();

      const result = await sendTelegramMessage({ chatId, telegramUserId, username, text, token });

      if (clientId) {
        await admin.firestore().collection("users").doc(clientId).collection("telegramMessages").add({
          type: "manual",
          text,
          username: username || "",
          chatId: chatId || "",
          telegramUserId: telegramUserId || "",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "sent"
        });
      }

      return json(res, 200, { ok: true, result });
    } catch (error) {
      console.error("telegramSendMessage error:", error);
      return json(res, 500, { ok: false, error: error.message });
    }
  }
);

function getMinskTomorrowInfo() {
  const now = new Date();
  const minskTomorrow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
  minskTomorrow.setDate(minskTomorrow.getDate() + 1);

  const jsDay = minskTomorrow.getDay();
  const dayMap = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };

  const yyyy = minskTomorrow.getFullYear();
  const mm = String(minskTomorrow.getMonth() + 1).padStart(2, "0");
  const dd = String(minskTomorrow.getDate()).padStart(2, "0");

  return {
    dayId: dayMap[jsDay],
    key: `${yyyy}-${mm}-${dd}`,
    text: minskTomorrow.toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone: "Europe/Minsk"
    })
  };
}

function getMinskNowMinutes() {
  const minskNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Minsk" }));
  return minskNow.getHours() * 60 + minskNow.getMinutes();
}

function getTimeMinutes(time = "") {
  const [h, m] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function shouldSendReminderNow(reminderTime = "20:00") {
  const target = getTimeMinutes(reminderTime);
  if (target === null) return false;

  const diff = getMinskNowMinutes() - target;
  return diff >= 0 && diff < 5;
}

function getWorkoutOrderIndex(workout = {}, fallbackIndex = 0) {
  const nameMatch = String(workout.name || "").match(/день\s*(\d+)|day\s*(\d+)/i);
  if (nameMatch?.[1] || nameMatch?.[2]) {
    const value = Number(nameMatch?.[1] || nameMatch?.[2]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  if (Number.isFinite(Number(workout.order))) return Number(workout.order);
  if (Number.isFinite(Number(workout.sortOrder))) return Number(workout.sortOrder);

  const idMatch = String(workout.id || "").match(/day[_-]?(\d+)|w[_-]?(\d+)|(\d+)/i);
  const idValue = Number(idMatch?.[1] || idMatch?.[2] || idMatch?.[3]);

  return Number.isFinite(idValue) && idValue > 0 ? idValue : fallbackIndex + 1;
}

async function getNextWorkoutForUser(userId) {
  const workoutsSnapshot = await admin.firestore().collection("users").doc(userId).collection("workouts").get();

  const workouts = workoutsSnapshot.docs
    .map((workoutDoc, index) => ({ id: workoutDoc.id, ...workoutDoc.data(), fallbackIndex: index }))
    .sort((a, b) => getWorkoutOrderIndex(a, a.fallbackIndex) - getWorkoutOrderIndex(b, b.fallbackIndex));

  if (!workouts.length) return null;

  const historySnapshot = await admin.firestore()
    .collection("users")
    .doc(userId)
    .collection("history")
    .orderBy("date", "desc")
    .limit(1)
    .get()
    .catch(() => null);

  if (!historySnapshot || historySnapshot.empty) return workouts[0];

  const lastHistory = historySnapshot.docs[0].data();
  const lastWorkoutName = String(lastHistory.workout || lastHistory.name || "");
  const lastIndex = workouts.findIndex((workout) => String(workout.name || "").trim() === lastWorkoutName.trim());

  return lastIndex === -1 ? workouts[0] : workouts[(lastIndex + 1) % workouts.length];
}

function buildWorkoutReminderMessage({ workout, workoutTime, tomorrowText, test = false }) {
  const workoutName = workout?.name || "тренировка";
  const exerciseCount = Array.isArray(workout?.exercises) ? workout.exercises.length : 0;
  const exercisesLine = exerciseCount ? `В плане: ${exerciseCount} упражнений.` : "План тренировки уже в приложении.";

  return [
    test ? "🧪 Тестовое напоминание о тренировке" : "🏋️‍♂️ Напоминание о тренировке",
    "",
    `Завтра (${tomorrowText}) у тебя тренировка в ${workoutTime}.`,
    `Тренировка: ${workoutName}`,
    exercisesLine,
    "",
    "Подготовь форму, воду, сон и нормальный приём еды заранее 💪"
  ].join("\n");
}

async function sendWorkoutReminderForClient(clientId, { test = false } = {}) {
  const userRef = admin.firestore().collection("users").doc(clientId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) throw new Error("User not found");

  const user = userSnap.data() || {};
  const telegram = user.telegram || {};
  const calendar = user.workoutCalendar || {};
  const tomorrow = getMinskTomorrowInfo();

  const chatId = telegram.chatId || user.telegramChatId || "";
  const telegramUserId = telegram.telegramUserId || user.telegramUserId || "";
  const username = telegram.username || user.telegramUsername || "";

  if (!normalizeTelegramTarget({ chatId, telegramUserId, username })) {
    throw new Error("Telegram is not connected");
  }

  const workout = await getNextWorkoutForUser(clientId);
  const workoutTime = calendar.workoutTime || user.workoutTime || "13:00";

  const text = buildWorkoutReminderMessage({
    workout,
    workoutTime,
    tomorrowText: tomorrow.text,
    test
  });

  const token = TELEGRAM_BOT_TOKEN.value();

  const result = await sendTelegramMessage({
    chatId,
    telegramUserId,
    username,
    text,
    token
  });

  const docId = test ? `test_reminder_${Date.now()}` : `workout_reminder_${tomorrow.key}_${String(calendar.reminderTime || "20:00").replace(":", "-")}`;

  await userRef.collection("telegramMessages").doc(docId).set({
    type: test ? "test_reminder" : "workout_reminder",
    text,
    workoutId: workout?.id || "",
    workoutName: workout?.name || "",
    workoutTime,
    reminderTime: calendar.reminderTime || "20:00",
    reminderDateKey: tomorrow.key,
    reminderDateText: tomorrow.text,
    scheduledForDay: tomorrow.dayId,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "sent"
  }, { merge: true });

  return result;
}

export const telegramTestWorkoutReminder = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const { clientId } = req.body || {};
      if (!clientId) return json(res, 400, { ok: false, error: "Missing clientId" });

      const result = await sendWorkoutReminderForClient(clientId, { test: true });
      return json(res, 200, { ok: true, result });
    } catch (error) {
      console.error("telegramTestWorkoutReminder error:", error);
      return json(res, 500, { ok: false, error: error.message });
    }
  }
);

export const telegramDailyWorkoutReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Europe/Minsk",
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const tomorrow = getMinskTomorrowInfo();

    const usersSnapshot = await admin.firestore().collection("users").where("telegramConnected", "==", true).get();

    const jobs = usersSnapshot.docs.map(async (userDoc) => {
      const user = userDoc.data();
      const calendar = user.workoutCalendar || {};

      if (calendar.enabled === false || calendar.reminderEnabled === false) return;
      if (!shouldSendReminderNow(calendar.reminderTime || "20:00")) return;
      if (!Array.isArray(calendar.trainingDays) || !calendar.trainingDays.includes(tomorrow.dayId)) return;

      const reminderDocId = `workout_reminder_${tomorrow.key}_${String(calendar.reminderTime || "20:00").replace(":", "-")}`;
      const reminderRef = userDoc.ref.collection("telegramMessages").doc(reminderDocId);
      const existingReminder = await reminderRef.get();

      if (existingReminder.exists) return;

      await sendWorkoutReminderForClient(userDoc.id);
    });

    await Promise.allSettled(jobs);
  }
);

export const telegramSetWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    try {
      const webhookUrl = req.query.url || req.body?.url;

      if (!webhookUrl) {
        return json(res, 400, { ok: false, error: "Pass ?url=https://YOUR_WEBHOOK_URL" });
      }

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN.value()}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl })
      });

      const data = await response.json();
      return json(res, response.ok ? 200 : 500, data);
    } catch (error) {
      console.error("telegramSetWebhook error:", error);
      return json(res, 500, { ok: false, error: error.message });
    }
  }
);

export const telegramWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN],
    cors: true
  },
  async (req, res) => {
    return json(res, 200, { ok: true });
  }
);


export const aiFoodPhoto = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: [OPENAI_API_KEY],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

    try {
      const { imageData, mimeType = "image/jpeg", fileName = "food-photo" } = req.body || {};

      if (!imageData || typeof imageData !== "string") {
        return json(res, 400, { ok: false, error: "Missing imageData" });
      }

      const cleanImageData = imageData.includes(",") ? imageData.split(",").pop() : imageData;
      const apiKey = OPENAI_API_KEY.value();

      if (!apiKey) {
        return json(res, 500, { ok: false, error: "OPENAI_API_KEY is not configured" });
      }

      const systemPrompt = [
        "You are a strict food package OCR and nutrition-label extraction system.",
        "Do not guess a generic food if a package or nutrition label is visible.",
        "The package text has priority over common products and local database matches.",
        "If the label shows brand, flavor, additives or product line, include them in the product name.",
        "If the product is TEOS Greek yogurt with cereals and flax fiber, return that exact product meaning, not plain Greek yogurt.",
        "Nutrition values from the label are the highest priority.",
        "If values are per 100 g, return calories/protein/fat/carbs per 100 g.",
        "If you can read text partially, preserve the exact visible words instead of simplifying.",
        "Return JSON only."
      ].join("\n");

      const userPrompt = [
        "Analyze this food package/nutrition label photo.",
        "Extract exact product name, brand, additives/flavor and KBJU.",
        "Prefer OCR label values. Do not replace this with a generic database item.",
        "Return this JSON shape:",
        "{",
        '  "ok": true,',
        '  "name": "full product name from package",',
        '  "brand": "brand if visible",',
        '  "query": "search/exact product query",',
        '  "calories": number_per_100g,',
        '  "protein": number_per_100g,',
        '  "fat": number_per_100g,',
        '  "carbs": number_per_100g,',
        '  "portion": "100 г",',
        '  "servingSize": "visible serving size if any",',
        '  "ingredients": ["visible important additives/flavor"],',
        '  "detectedIngredients": ["visible important additives/flavor"],',
        '  "confidence": "high|medium|low",',
        '  "candidates": [',
        '    {"name":"same exact product", "brand":"", "calories":0, "protein":0, "fat":0, "carbs":0, "portion":"100 г", "source":"label"}',
        "  ]",
        "}"
      ].join("\n");

      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemPrompt }]
            },
            {
              role: "user",
              content: [
                { type: "input_text", text: `${userPrompt}\nFile name: ${fileName}` },
                { type: "input_image", image_url: `data:${mimeType};base64,${cleanImageData}` }
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "food_label_ocr",
              schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                  ok: { type: "boolean" },
                  name: { type: "string" },
                  brand: { type: "string" },
                  query: { type: "string" },
                  calories: { type: "number" },
                  protein: { type: "number" },
                  fat: { type: "number" },
                  carbs: { type: "number" },
                  portion: { type: "string" },
                  servingSize: { type: "string" },
                  ingredients: { type: "array", items: { type: "string" } },
                  detectedIngredients: { type: "array", items: { type: "string" } },
                  confidence: { type: "string" },
                  candidates: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: true,
                      properties: {
                        name: { type: "string" },
                        brand: { type: "string" },
                        calories: { type: "number" },
                        protein: { type: "number" },
                        fat: { type: "number" },
                        carbs: { type: "number" },
                        portion: { type: "string" },
                        source: { type: "string" }
                      }
                    }
                  }
                },
                required: ["ok", "name", "query", "confidence", "candidates"]
              }
            }
          },
          max_output_tokens: 1200
        })
      });

      const raw = await openAiResponse.text();

      if (!openAiResponse.ok) {
        console.error("OpenAI aiFoodPhoto error:", raw);
        return json(res, 500, { ok: false, error: "OpenAI request failed", details: raw.slice(0, 800) });
      }

      let parsed = null;

      try {
        const responseData = JSON.parse(raw);
        const outputText = responseData.output_text
          || responseData.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text
          || "";
        parsed = JSON.parse(outputText);
      } catch (error) {
        console.error("aiFoodPhoto parse error:", error, raw);
        return json(res, 500, { ok: false, error: "AI response parse failed" });
      }

      const name = String(parsed.name || parsed.query || "Новый продукт").trim();
      const brand = String(parsed.brand || "").trim();
      const detectedIngredients = Array.isArray(parsed.detectedIngredients)
        ? parsed.detectedIngredients
        : Array.isArray(parsed.ingredients)
          ? parsed.ingredients
          : [];

      const exactName = [brand, name, ...detectedIngredients].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

      const candidate = {
        name: exactName || name,
        brand,
        calories: Number(parsed.calories) || 0,
        protein: Number(parsed.protein) || 0,
        fat: Number(parsed.fat) || 0,
        carbs: Number(parsed.carbs) || 0,
        portion: parsed.portion || "100 г",
        portionAmount: 100,
        source: "AI этикетка",
        confidence: parsed.confidence || "medium"
      };

      return json(res, 200, {
        ok: true,
        name: candidate.name,
        query: candidate.name,
        brand,
        calories: candidate.calories,
        protein: candidate.protein,
        fat: candidate.fat,
        carbs: candidate.carbs,
        portion: candidate.portion,
        servingSize: parsed.servingSize || "",
        ingredients: detectedIngredients,
        detectedIngredients,
        confidence: parsed.confidence || "medium",
        candidates: [candidate]
      });
    } catch (error) {
      console.error("aiFoodPhoto fatal error:", error);
      return json(res, 500, { ok: false, error: error.message || String(error) });
    }
  }
);

