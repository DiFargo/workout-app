export const MAX_USER_DISPLAY_NAME_LENGTH = 20;

export function limitUserDisplayName(value) {
  return String(value ?? "")
    .trim()
    .slice(0, MAX_USER_DISPLAY_NAME_LENGTH);
}
