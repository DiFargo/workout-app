export const MAX_USER_DISPLAY_NAME_LENGTH = 20;

export function limitUserDisplayName(value) {
  const name = String(value ?? "").trim();
  return (name.charAt(0).toLocaleUpperCase("ru-RU") + name.slice(1))
    .slice(0, MAX_USER_DISPLAY_NAME_LENGTH);
}
