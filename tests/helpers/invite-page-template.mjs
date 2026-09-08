import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { INVITE_PAGE_STYLES, formatInviteAccountLabel } from "../../functions/invitePageStyles.js";

// Exercise the real server HTML without booting Firebase or using real invite codes.
const source = readFileSync(new URL("../../functions/index.js", import.meta.url), "utf8");
export function renderInviteFixture(kind = "activation", overrides = {}) {
  const name = kind === "activation" ? "renderInviteActivationPageTemplate" : "renderInviteLinkNoticePageTemplate";
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\n}", start) + 2;
  if (start < 0 || end < start) throw new Error("Invitation template not found");
  const render = runInNewContext(`(${source.slice(start, end)})`, {
    INVITE_PAGE_STYLES,
    formatInviteAccountLabel,
    getWorkoutAppUrl: () => "https://example.test/",
    WORKOUT_APP_URL: "https://example.test/",
    escapeHtml: value => String(value || "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char])
  });
  return render({ actionCode: "test-only-invite-code", login: "nargo", email: "nargo@example.test", title: "Пароль уже создан", message: "Доступ активирован для аккаунта", statusLabel: "Можно войти в приложение", ...overrides });
}
