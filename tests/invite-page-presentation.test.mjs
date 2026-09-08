import test from "node:test";
import assert from "node:assert/strict";
import { formatInviteAccountLabel } from "../functions/invitePageStyles.js";
import { renderInviteFixture } from "./helpers/invite-page-template.mjs";

test("invite login casing is presentation-only and email fallback is unchanged", () => {
  const account = { login: "nargo", email: "nargo@example.test" };
  assert.equal(formatInviteAccountLabel(account), "Логин: Nargo");
  assert.equal(account.login, "nargo");
  assert.equal(formatInviteAccountLabel({ email: "test@example.test" }), "test@example.test");
  assert.equal(formatInviteAccountLabel({ login: "alex_Name" }), "Логин: Alex_Name");
});

test("both standalone invite states render the display login and retain the sign-in link", () => {
  for (const kind of ["activation", "notice"]) {
    const html = renderInviteFixture(kind);
    assert.match(html, /Логин: Nargo/);
    assert.match(html, /https:\/\/example\.test\//);
    assert.match(html, /Перейти ко входу/);
  }
});

test("invite notice still escapes the account label", () => {
  assert.match(renderInviteFixture("notice", { login: "", email: '<test>@example.test' }), /&lt;test&gt;@example.test/);
});
