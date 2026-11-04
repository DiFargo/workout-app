export function measurementTimestamp(measurement = {}) {
  const raw = measurement.date || measurement.createdAt || measurement.savedAt || 0;
  const dateOnly = typeof raw === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null;
  const timestamp = (dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12) : new Date(raw)).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function progressPeriodRange(period, now = new Date()) {
  const days = period === "year" ? 366 : period === "halfYear" ? 183 : 30;
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days + 1);
  return { from, to, days };
}

export function getPeriodMeasurements(measurements, period, now = new Date()) {
  const { from, to } = progressPeriodRange(period, now);
  return measurements.filter(item => {
    const time = measurementTimestamp(item);
    return time >= from.getTime() && time <= to.getTime();
  });
}

export function buildWeightChart(measurements, maxPoints = 12) {
  const allPoints = measurements.map(measurement => {
    const raw = measurement.weight;
    const value = raw === null || raw === undefined || String(raw).trim() === "" ? NaN : Number(String(raw).replace(",", "."));
    return { value, timestamp: measurementTimestamp(measurement), measurement };
  }).filter(item => Number.isFinite(item.value) && item.timestamp).sort((a, b) => a.timestamp - b.timestamp);
  const points = allPoints.length <= maxPoints ? allPoints : Array.from({ length: maxPoints }, (_, i) => allPoints[Math.round(i * (allPoints.length - 1) / (maxPoints - 1))]);
  if (!points.length) return { points: [], path: "", area: "", min: 0, max: 0 };
  const values = allPoints.map(item => item.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const start = points[0].timestamp, duration = points.at(-1).timestamp - start;
  const coordinates = points.map(item => ({ ...item, x: duration ? 8 + (item.timestamp - start) / duration * 304 : 160, y: 18 + (max - item.value) / range * 62 }));
  const path = coordinates.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  return { points: coordinates, path, area: `${path} L${coordinates.at(-1).x.toFixed(1)} 92 L${coordinates[0].x.toFixed(1)} 92 Z`, min, max };
}
