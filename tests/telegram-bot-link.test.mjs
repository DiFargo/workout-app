import assert from "node:assert/strict";
import test from "node:test";
import { buildTelegramBotLinkUrl, openTelegramBotLink } from "../src/utils/telegramBotLink.js";

const code = "synthetic_link_code_123456";
const url = `https://t.me/example_bot?start=${code}`;
const click = (extra = {}) => ({ type: "click", button: 0, prevented: false, preventDefault() { this.prevented = true; }, ...extra });

test("bot link is built only from the trusted configured username and a bounded code", () => {
  assert.equal(buildTelegramBotLinkUrl(" @Example_Bot ", code), url);
  for (const bot of ["", "bot", "evil.example/path", "example_bot?start=evil", "https://t.me/example_bot"]) assert.equal(buildTelegramBotLinkUrl(bot, code), "");
  for (const invalid of ["short", "x".repeat(61), "contains spaces 1234567890", "x".repeat(20) + "&next=evil", ` ${code}`]) assert.equal(buildTelegramBotLinkUrl("example_bot", invalid), "");
  for (const length of [20, 60]) assert.ok(buildTelegramBotLinkUrl("example_bot", "x".repeat(length)));
});

test("an explicit normal click prefers Telegram SDK and prevents the anchor only after success", () => {
  const event = click();
  const calls = [];
  const host = { Telegram: { WebApp: { openTelegramLink: value => calls.push(value) } } };
  assert.equal(openTelegramBotLink(event, url, host), true);
  assert.deepEqual(calls, [url]);
  assert.equal(event.prevented, true);
});

test("missing, throwing or explicitly rejecting SDK leaves the real anchor fallback untouched", () => {
  for (const host of [{}, { Telegram: { WebApp: { openTelegramLink() { throw new Error("Synthetic SDK failure"); } } } },
    { Telegram: { WebApp: { openTelegramLink: () => false } } }]) {
    const event = click();
    assert.equal(openTelegramBotLink(event, url, host), false);
    assert.equal(event.prevented, false);
  }
});

test("no event, non-click, modified clicks and unsafe URLs never invoke the SDK", () => {
  let calls = 0;
  const host = { Telegram: { WebApp: { openTelegramLink() { calls += 1; } } } };
  for (const event of [undefined, click({ type: "submit" }), click({ ctrlKey: true }), click({ defaultPrevented: true }), click({ button: 1 })]) {
    assert.equal(openTelegramBotLink(event, url, host), false);
  }
  for (const unsafe of ["https://evil.example/?start=" + code, url + "&redirect=evil", url + "#fragment", url.replace("https:", "http:")]) {
    assert.equal(openTelegramBotLink(click(), unsafe, host), false);
  }
  assert.equal(calls, 0);
});
