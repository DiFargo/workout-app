import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const bundle = await rolldown({
  input: fileURLToPath(new URL("../src/components/admin/AdminUsersWorkspace.jsx", import.meta.url)),
  platform: "node", transform: { jsx: { runtime: "automatic" } },
  external: ["react", "react/jsx-runtime", "lucide-react"],
  plugins: [{ name: "css-stub", load: id => id.endsWith(".css") ? { code: "export default {};", moduleType: "js" } : null }]
});
const generated = await bundle.generate({ format: "cjs", exports: "named" });
await bundle.close();
const module = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), module, module.exports);
const { getAdminAccountStatus } = module.exports;

test("explicit lifecycle restrictions are never presented as active", () => {
  const cases = [
    [{ accountAccessStatus: "awaiting_trainer" }, "Ожидает назначения тренера"],
    [{ membershipStatus: "suspended", accountStatus: "active" }, "Доступ приостановлен"],
    [{ membershipStatus: "revoked", accountStatus: "active" }, "Доступ отозван"],
    [{ status: "revoked" }, "Доступ отозван"],
    [{ archived: true, accountStatus: "active" }, "Архив"],
    [{ active: false, accountStatus: "active" }, "Неактивен"],
    [{ accessDisabled: true, accountAccessStatus: "awaiting_trainer" }, "Доступ ограничен"],
    [{ disabled: true }, "Доступ ограничен"],
    [{ accountStatus: "pending" }, "Ожидает активации"]
  ];
  for (const [profile, expected] of cases) {
    const actual = getAdminAccountStatus(profile);
    assert.equal(actual.label, expected);
    assert.notEqual(actual.id, "active");
  }
});

test("active and legacy compatible accounts retain their active presentation", () => {
  for (const profile of [{}, { accountStatus: "active", active: true, membershipStatus: "active" }]) {
    assert.deepEqual(getAdminAccountStatus(profile), { id: "active", label: "Активен" });
  }
});
