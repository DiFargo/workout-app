const WEIGHT_MIN = 40;
const WEIGHT_MAX = 250;
const WEIGHT_WINDOW_RADIUS = 40;
const AGE_MIN = 14;
const AGE_MIDPOINT = 35;
const AGE_MAX = 80;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getWeightSliderWindow(value) {
  const weight = clamp(Number(value), WEIGHT_MIN, WEIGHT_MAX);
  const min = Math.max(WEIGHT_MIN, weight - WEIGHT_WINDOW_RADIUS);
  const max = Math.min(WEIGHT_MAX, weight + WEIGHT_WINDOW_RADIUS);

  return { min, midpoint: weight, max };
}

export function ageToCenteredSlider(value) {
  const age = clamp(Number(value), AGE_MIN, AGE_MAX);

  if (age <= AGE_MIDPOINT) {
    return ((age - AGE_MIN) / (AGE_MIDPOINT - AGE_MIN)) * 50;
  }

  return 50 + ((age - AGE_MIDPOINT) / (AGE_MAX - AGE_MIDPOINT)) * 50;
}

export function centeredSliderToAge(value) {
  const slider = clamp(Number(value), 0, 100);

  if (slider <= 50) {
    return AGE_MIN + (slider / 50) * (AGE_MIDPOINT - AGE_MIN);
  }

  return AGE_MIDPOINT + ((slider - 50) / 50) * (AGE_MAX - AGE_MIDPOINT);
}
