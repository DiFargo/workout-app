import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("profile saves show a green confirmation before closing their current screen", async () => {
  const [notice, measurements, measurementHandlers, photos, questionnaire] = await Promise.all([
    readFile("src/shared/ui/SaveSuccessNotice.jsx", "utf8"),
    readFile("src/features/client/measurements/MeasurementWizardPage.jsx", "utf8"),
    readFile("src/features/client/profile/profileProgressHandlers.js", "utf8"),
    readFile("src/features/client/profile/ProfileProgressPhotosModal.jsx", "utf8"),
    readFile("src/features/client/profile/ProfileBodyMetricsSettingsSection.jsx", "utf8")
  ]);

  assert.match(notice, /duration = 2400/);
  assert.match(measurements, /const measurementSaved = !profileMeasurementSaving && profileMeasurementStatus\.startsWith\("Замер сохранён"\)/);
  assert.match(measurements, /title="Замеры сохранены"[\s\S]*?onComplete=\{closeMeasurementWizard\}/);
  assert.doesNotMatch(measurementHandlers, /closeSavedMeasurement/);
  assert.match(photos, /const saved = String\(status \|\| ""\)\.includes\("сохранены"\)/);
  assert.match(photos, /title="Фото сохранены"/);
  assert.match(questionnaire, /title="Анкета сохранена"/);
});
