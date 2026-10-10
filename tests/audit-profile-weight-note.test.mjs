import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Compile the real JSX component; the assertions cover rendered behavior rather
// than matching an implementation string. No application files are emitted.
const bundle = await rolldown({
  input: fileURLToPath(new URL("../src/features/client/profile/ProfileMeasurementWizardPanel.jsx", import.meta.url)),
  platform: "node", transform: { jsx: { runtime: "automatic" } },
  plugins: [{ name: "test-css-boundary", load: (id) => id.endsWith(".css") ? { code: "export default {};", moduleType: "js" } : null }],
  external: ["react", "react/jsx-runtime", "lucide-react"]
});
const generated = await bundle.generate({ format: "cjs", exports: "named" });
await bundle.close();
const module = { exports: {} };
new Function("require", "module", "exports", generated.output[0].code)(createRequire(import.meta.url), module, module.exports);
const Panel = module.exports.default;
const render = (measurements, latestMeasurement = null) => renderToStaticMarkup(React.createElement(Panel, {
  visible: true, measurements, latestMeasurement, measurementFields: [{ id: "weight" }],
  formatMeasurementDate: ({ date }) => date, onAddWeight: () => {}, onStart: () => {}, onOpenPhotos: () => {}
}));
const weightCard = (html) => html.match(/<section[^>]*data-testid="profile-progress-weight-card"[\s\S]*?<\/section>/)?.[0];

test("a weight-only check-in shows its date instead of asking for a first measurement", () => {
  const html = render([{ id: "weight", weight: "124.3", date: "2026-08-25", measurementType: "weight_checkin" }]);
  const card = weightCard(html);
  assert.match(card, /Последний вес: 2026-08-25/);
  assert.doesNotMatch(card, /Добавьте первый замер/);
  assert.match(card, /124,3/);
  // The separate body wizard still has no circumference measurements.
  assert.match(html, /Замеры тела<\/strong><small>Добавьте первый замер/);
});

test("weight note uses the last record with a weight, independently of the body wizard", () => {
  const body = { id: "body", chest: "110", date: "2026-10-08", measurementType: "body_measurement" };
  const html = render([body, { id: "weight", weight: "120", date: "2026-10-07", measurementType: "weight_checkin" }], body);
  assert.match(weightCard(html), /Последний вес: 2026-10-07/);
  assert.match(html, /Последний замер: 2026-10-08/);
});

test("empty weight history asks for the first weight", () => {
  assert.match(weightCard(render([])), /Добавьте первый вес/);
  assert.doesNotMatch(weightCard(render([])), /Последний вес:/);
});
