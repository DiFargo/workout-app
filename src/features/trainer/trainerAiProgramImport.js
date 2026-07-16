import { fetchAuthorizedWithTimeout } from "../../utils/apiClient";

const TRAINER_AI_PROGRAM_TIMEOUT_MS = 90000;
const TRAINER_AI_PROGRAM_MAX_FILE_BYTES = 8 * 1024 * 1024;
const TEXT_FILE_EXTENSIONS = /\.(txt|md|markdown|csv|json)$/i;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Не получилось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

async function readFilePayload(file) {
  if (!file) return null;
  if (file.size > TRAINER_AI_PROGRAM_MAX_FILE_BYTES) {
    throw new Error("Файл слишком большой. Загрузите файл до 8 МБ или вставьте текст программы.");
  }

  const mimeType = String(file.type || "").toLowerCase();
  const fileName = String(file.name || "program-file");
  const isImage = mimeType.startsWith("image/");
  const isText = mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("csv") ||
    TEXT_FILE_EXTENSIONS.test(fileName);

  if (isImage) {
    return {
      fileName,
      mimeType: mimeType || "image/jpeg",
      imageData: await readFileAsDataUrl(file)
    };
  }

  if (isText) {
    return {
      fileName,
      mimeType: mimeType || "text/plain",
      text: await file.text()
    };
  }

  return {
    fileName,
    mimeType: mimeType || "application/octet-stream",
    fileData: await readFileAsDataUrl(file)
  };
}

export async function requestTrainerAiProgramImport({ text = "", file = null } = {}) {
  const filePayload = await readFilePayload(file);
  const body = {
    text: String(text || ""),
    ...(filePayload || {})
  };

  const response = await fetchAuthorizedWithTimeout("/api/ai-workout-program-import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, TRAINER_AI_PROGRAM_TIMEOUT_MS);

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || data.error || "Не получилось распознать программу.");
  }
  if (!data.program) {
    throw new Error("ИИ не вернул структуру программы.");
  }

  return data.program;
}
