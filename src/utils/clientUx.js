export const CLIENT_PRIMARY_PAGES = Object.freeze([
  "main",
  "workouts",
  "nutrition",
  "profile"
]);

export function normalizeClientPrimaryPage(value, fallback = "main") {
  return CLIENT_PRIMARY_PAGES.includes(value) ? value : fallback;
}

export function isEmailLogin(value) {
  return String(value || "").includes("@");
}

export function normalizeLoginAlias(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getDefaultLoginAlias(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const [localPart] = cleanEmail.split("@");
  return /^[a-z0-9._-]{3,32}$/.test(localPart || "") ? localPart : "";
}

export function validateLoginFields(email, password, options = {}) {
  const { passwordRequired = true } = options;
  const cleanLogin = String(email || "").trim();
  const cleanPassword = String(password || "");
  const errors = {};

  if (!cleanLogin) {
    errors.email = "Укажи логин или email.";
  } else if (isEmailLogin(cleanLogin) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanLogin)) {
    errors.email = "Проверь формат email.";
  } else if (!isEmailLogin(cleanLogin) && !/^[a-zA-Z0-9._-]{3,32}$/.test(cleanLogin)) {
    errors.email = "Логин: 3-32 символа, латиница, цифры, точка, дефис или _.";
  }

  if (passwordRequired && !cleanPassword) {
    errors.password = "Укажи пароль.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    email: cleanLogin,
    login: cleanLogin,
    loginAlias: isEmailLogin(cleanLogin) ? "" : normalizeLoginAlias(cleanLogin),
    isEmail: isEmailLogin(cleanLogin),
    password: cleanPassword,
    errors
  };
}

export function mapLoginAuthError(error) {
  switch (error?.code) {
    case "auth/invite-required":
      return "Аккаунт не найден. Попроси тренера отправить приглашение.";
    case "auth/login-not-found":
      return "Логин не найден. Попробуй email или проверь написание.";
    case "auth/invalid-email":
      return "Проверь формат email.";
    case "auth/too-many-requests":
      return "Слишком много попыток. Попробуй немного позже.";
    case "auth/network-request-failed":
      return "Нет связи с сервером. Проверь интернет.";
    case "auth/user-disabled":
      return "Этот аккаунт отключён.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Неверный логин, email или пароль.";
    case "auth/popup-closed-by-user":
      return "Вход через Google отменён.";
    case "auth/popup-blocked":
      return "Браузер заблокировал окно Google. Разреши всплывающее окно и попробуй ещё раз.";
    case "auth/account-exists-with-different-credential":
      return "Аккаунт с этой почтой уже есть. Войди через email и пароль.";
    default:
      return "Не удалось войти. Попробуй ещё раз.";
  }
}

export function parsePositiveDecimal(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");

  if (!normalized) return null;

  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
}

export function parseNonNegativeDecimal(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");

  if (!normalized) return null;

  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : null;
}

export function validateNutritionAmount(value) {
  const amount = parsePositiveDecimal(value);

  return amount === null
    ? { valid: false, amount: null, error: "Укажи количество больше нуля." }
    : { valid: true, amount, error: "" };
}

export function validateNutritionFoodDraft(food) {
  const errors = {};
  const name = String(food?.name || "").trim();
  const calories = parseNonNegativeDecimal(food?.calories);
  const protein = parseNonNegativeDecimal(food?.protein);
  const fat = parseNonNegativeDecimal(food?.fat);
  const carbs = parseNonNegativeDecimal(food?.carbs);
  const portionAmount = parsePositiveDecimal(
    food?.type === "dish"
      ? (food?.totalWeight ?? food?.portionAmount)
      : food?.portionAmount
  );

  if (!name) errors.name = "Укажи название.";
  if (calories === null) errors.calories = "Калории должны быть числом от 0.";
  if (protein === null) errors.protein = "Белки должны быть числом от 0.";
  if (fat === null) errors.fat = "Жиры должны быть числом от 0.";
  if (carbs === null) errors.carbs = "Углеводы должны быть числом от 0.";
  if (portionAmount === null) errors.portionAmount = "Вес порции должен быть больше нуля.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: {
      name,
      calories,
      protein,
      fat,
      carbs,
      portionAmount
    }
  };
}
