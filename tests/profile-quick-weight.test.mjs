import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("saving a weight from the cabinet keeps the client in the cabinet", async () => {
  const route = await readFile("src/features/client/profile/ProfileDashboardRoute.jsx", "utf8");
  const quickWeightModal = route.match(/<ProfileQuickWeightModal[\s\S]*?\/>/)?.[0] || "";
  const quickWeightDialog = await readFile("src/features/client/profile/ProfileQuickWeightModal.jsx", "utf8");

  assert.match(quickWeightModal, /onSuccessAcknowledged=\{\(\) => \{[\s\S]*?setQuickWeightModalOpen\(false\);/);
  assert.doesNotMatch(quickWeightModal, /setPage\(APP_PAGES\.MAIN\)/);
  assert.match(quickWeightDialog, /title="Вес сохранён"/);
  assert.match(quickWeightDialog, /Новая запись добавлена в динамику веса/);
});
