import assert from "node:assert/strict";
import test from "node:test";
import { parseSmokeArgs, makeSmokeIdentities, safeSmokeError, verifyTemplatePurposeUi, verifyAdminLibraryUi } from "../scripts/smoke-audit-remediation.mjs";

test("exercise preview smoke is explicit, staging-only and requires workout UI", () => {
  const staging = ["--run", "--project=tren-85720-staging"];
  assert.equal(parseSmokeArgs([...staging, "--workout-ui", "--exercise-preview"], {}).exercisePreview, true);
  assert.throws(() => parseSmokeArgs([...staging, "--exercise-preview"], {}));
  assert.throws(() => parseSmokeArgs([...staging, "--workout-ui", "--exercise-preview", "--exercise-preview"], {}));
  assert.throws(() => parseSmokeArgs(["--run", "--project=tren-85720", "--confirm-project=tren-85720", "--workout-ui", "--exercise-preview"], {}));
});

test("audit smoke requires explicit run and exact project, with additional Production confirmation", () => {
  assert.throws(() => parseSmokeArgs([], {}));
  assert.throws(() => parseSmokeArgs(["--run"], {}));
  assert.throws(() => parseSmokeArgs(["--run", "--project=tren-85720-staging.evil"], {}));
  assert.throws(() => parseSmokeArgs(["--run", "--project=tren-85720"], {}));
  assert.throws(() => parseSmokeArgs(["--run", "--project=tren-85720", "--confirm-project=tren-85720-staging"], {}));
  assert.equal(parseSmokeArgs(["--run", "--project=tren-85720", "--confirm-project=tren-85720"], {}).project, "tren-85720");
  assert.equal(parseSmokeArgs(["--run", "--project=tren-85720-staging"], {}).ledger, false);
  assert.equal(parseSmokeArgs(["--run", "--project=tren-85720-staging"], {}).templatePurpose, false);
  assert.equal(parseSmokeArgs(["--run", "--project=tren-85720-staging"], {}).adminLibrary, false);
  assert.equal(parseSmokeArgs(["--run", "--project=tren-85720-staging"], {}).workoutUi, false);
});

test("workout-ui is explicit opt-in and preserves exact Production, duplicate and argument guards", () => {
  const staging = ["--run", "--project=tren-85720-staging", "--expected-version=3.0.854"];
  const parsed = parseSmokeArgs([...staging, "--workout-ui"], {});
  assert.equal(parsed.workoutUi, true);
  assert.equal(parsed.ledger, false);
  assert.throws(() => parseSmokeArgs([...staging, "--workout-ui", "--workout-ui"], {}));
  assert.throws(() => parseSmokeArgs([...staging, "--workout-ui=true"], {}));
  assert.throws(() => parseSmokeArgs(["--run", "--project=tren-85720", "--workout-ui"], {}));
  assert.equal(parseSmokeArgs(["--run", "--project=tren-85720", "--confirm-project=tren-85720", "--workout-ui"], {}).workoutUi, true);
});

test("admin-library is opt-in and cannot bypass Production, duplicate or unknown-argument guards", () => {
  const base = ["--run", "--project=tren-85720", "--confirm-project=tren-85720", "--expected-version=3.0.852"];
  const parsed = parseSmokeArgs([...base, "--admin-library", "--template-purpose"], {});
  assert.equal(parsed.adminLibrary, true); assert.equal(parsed.templatePurpose, true); assert.equal(parsed.ledger, false);
  assert.throws(() => parseSmokeArgs([...base, "--admin-library", "--admin-library"], {}));
  assert.throws(() => parseSmokeArgs(["--run", "--project=tren-85720", "--admin-library"], {}));
  assert.throws(() => parseSmokeArgs([...base, "--admin-library=true"], {}));
});

function adminLibraryFixture({ wrongPanel = false, overflow = false } = {}) {
  let active = "";
  const clicks = [];
  const titles = ["Базовые программы", "Базовые упражнения"];
  const page = { evaluate: async () => !overflow,
    getByTestId(id) {
      assert.ok(["route-loading", "admin-base-library"].includes(id));
      return { visible: () => id === "admin-base-library" && Boolean(active) };
    },
    getByRole(role, options) {
      assert.equal(options.exact, true);
      if (role === "navigation") {
        assert.equal(options.name, "Разделы админки");
        return { getByRole(childRole, childOptions) {
          assert.equal(childRole, "button"); assert.equal(childOptions.exact, true);
          assert.ok(titles.includes(childOptions.name), "Only read-only library navigation may be clicked");
          return { click: async () => { active = childOptions.name; clicks.push(active); },
            attribute: () => active === childOptions.name ? "page" : null };
        } };
      }
      assert.ok(["heading", "tabpanel"].includes(role));
      assert.ok(titles.includes(options.name));
      if (role === "heading") assert.equal(options.level, 1);
      return { visible: () => options.name === active && !(wrongPanel && role === "tabpanel") };
    }
  };
  const expect = target => ({
    toBeVisible: async () => assert.equal(target.visible(), true),
    toBeHidden: async () => assert.equal(target.visible(), false),
    toHaveAttribute: async (name, value) => { assert.equal(name, "aria-current"); assert.equal(target.attribute(), value); }
  });
  return { page, expect, clicks };
}

test("admin-library verifier visits both actual named panels using only navigation buttons", async () => {
  const ui = adminLibraryFixture();
  await verifyAdminLibraryUi(ui.page, ui.expect);
  assert.deepEqual(ui.clicks, ["Базовые программы", "Базовые упражнения"]);
});

test("admin-library verifier fails closed for a wrong panel or mobile overflow", async () => {
  for (const options of [{ wrongPanel: true }, { overflow: true }]) {
    const ui = adminLibraryFixture(options);
    await assert.rejects(verifyAdminLibraryUi(ui.page, ui.expect));
    assert.deepEqual(ui.clicks, ["Базовые программы"]);
  }
});

test("template-purpose is explicit opt-in and preserves Production confirmation and duplicate guards", () => {
  const base = ["--run", "--project=tren-85720-staging", "--template-purpose"];
  assert.equal(parseSmokeArgs(base, {}).templatePurpose, true);
  assert.equal(parseSmokeArgs(base, {}).ledger, false);
  assert.throws(() => parseSmokeArgs([...base, "--template-purpose"], {}));
  assert.throws(() => parseSmokeArgs(["--run", "--project=tren-85720", "--template-purpose"], {}));
  assert.equal(parseSmokeArgs(["--run", "--project=tren-85720", "--confirm-project=tren-85720", "--template-purpose"], {}).templatePurpose, true);
});

function templateUiFixture({ bodySize = "16px", headingSize = "18px", overflow = false } = {}) {
  const clicks = [];
  let dialogOpen = false;
  const close = { click: async () => { clicks.push("close"); dialogOpen = false; } };
  const dialog = { visible: () => dialogOpen, getByRole: (role, options) => {
    assert.equal(role, "button"); assert.deepEqual(options, { name: "Закрыть", exact: true }); return close;
  } };
  const create = { visible: () => true, click: async () => { clicks.push("open"); dialogOpen = true; } };
  const purpose = { visible: () => true, locator: selector => {
    assert.equal(selector, "p"); return { fontSize: bodySize };
  }, getByRole: (role, options) => {
    assert.equal(role, "heading"); assert.deepEqual(options, { name: "Шаблон — не план клиента", exact: true });
    return { fontSize: headingSize };
  } };
  const page = { evaluate: async () => !overflow, locator: selector => {
    assert.equal(selector, ".trainerNextMobileHeader:visible .trainerNextMobileTitle"); return { text: "Шаблоны программ" };
  }, getByRole: (role, options) => {
    assert.equal(options.exact, true);
    if (role === "complementary" && options.name === "Шаблон — не план клиента") return purpose;
    if (role === "button" && options.name === "Создать шаблон") return create;
    if (role === "dialog" && options.name === "Создать общий шаблон") return dialog;
    assert.fail("Unexpected UI action");
  } };
  const expect = target => ({ toBeVisible: async () => assert.equal(target.visible(), true),
    toBeHidden: async () => assert.equal(target.visible(), false),
    toHaveText: async text => assert.equal(target.text, text),
    toHaveCSS: async (property, value) => { assert.equal(property, "font-size"); assert.equal(target.fontSize, value); } });
  return { page, expect, clicks };
}

test("template-purpose verifier checks the actual read-only interaction contract without choosing a format", async () => {
  const ui = templateUiFixture();
  await verifyTemplatePurposeUi(ui.page, ui.expect);
  assert.deepEqual(ui.clicks, ["open", "close"]);
});

test("template-purpose verifier fails for unreadable typography or horizontal overflow before opening", async () => {
  for (const options of [{ bodySize: "12px" }, { headingSize: "16px" }, { overflow: true }]) {
    const ui = templateUiFixture(options);
    await assert.rejects(verifyTemplatePurposeUi(ui.page, ui.expect));
    assert.deepEqual(ui.clicks, []);
  }
});

test("audit smoke has no arbitrary URL, UID, role, credential or duplicated flag override", () => {
  const base = ["--run", "--project=tren-85720-staging"];
  for (const extra of ["--base=https://external.test", "--uid=real-user", "--admin=real-user", "--password=secret", "--run", "--project=tren-85720-staging"])
    assert.throws(() => parseSmokeArgs([...base, extra], {}));
  assert.throws(() => parseSmokeArgs([...base, "--expected-version=../../private"], {}));
  const valid = parseSmokeArgs([...base, "--ledger", "--expected-version=3.0.850"], {});
  assert.equal(valid.ledger, true); assert.equal(valid.version, "3.0.850");
});

test("only cached operator authentication and non-emulator endpoints are permitted", () => {
  for (const key of ["FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS", "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"])
    assert.throws(() => parseSmokeArgs(["--run", "--project=tren-85720-staging"], { [key]: "override" }));
});

test("three random synthetic identities are registered before requests and use non-deliverable emails", () => {
  const runId = "a".repeat(24), identities = makeSmokeIdentities(runId);
  assert.deepEqual(identities.map(value => value.role), ["trainer", "client", "admin"]);
  assert.ok(identities.every(value => value.email.endsWith("@example.invalid") && value.email.includes(runId)));
  assert.ok(identities.every(value => value.creationAttempted === false && value.absenceVerified === false));
  assert.ok(identities.every(value => !value.uid && !value.password && !value.idToken));
  assert.throws(() => makeSmokeIdentities("real-account"));
});

test("sanitized errors never serialize message, credential, request or response objects", () => {
  const diagnostic = safeSmokeError(Object.assign(new Error("synthetic-private-password/token/email@example.invalid"), {
    request: { authorization: "secret" }, response: { body: "private" }
  }));
  assert.deepEqual(diagnostic, { code: "assertion-or-operation-failed", name: "Error" });
  assert.equal(JSON.stringify(diagnostic).includes("private"), false);
});
