import assert from "node:assert/strict";
import test from "node:test";

import {
  ageToCenteredSlider,
  centeredSliderToAge,
  getWeightSliderWindow
} from "../src/features/auth/firstSetupMetricScale.js";

test("weight scale follows the current weight with a 40 kg window on each side", () => {
  assert.deepEqual(getWeightSliderWindow(80), { min: 40, midpoint: 80, max: 120 });
  assert.deepEqual(getWeightSliderWindow(100), { min: 60, midpoint: 100, max: 140 });
  assert.deepEqual(getWeightSliderWindow(42), { min: 40, midpoint: 42, max: 82 });
  assert.deepEqual(getWeightSliderWindow(240), { min: 200, midpoint: 240, max: 250 });
});

test("age scale centres the 35 year reference", () => {
  assert.equal(ageToCenteredSlider(14), 0);
  assert.equal(ageToCenteredSlider(35), 50);
  assert.equal(ageToCenteredSlider(80), 100);
  assert.equal(centeredSliderToAge(0), 14);
  assert.equal(centeredSliderToAge(50), 35);
  assert.equal(centeredSliderToAge(100), 80);
  assert.equal(Math.round(centeredSliderToAge(ageToCenteredSlider(30))), 30);
});
