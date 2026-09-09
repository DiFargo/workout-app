function escapeCsvText(value = "") {
  const text = String(value ?? "");
  // CSV consumers can skip leading control characters before evaluating formulas.
  // eslint-disable-next-line no-control-regex
  const safe = typeof value === "number" ? text : (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text);
  return safe.replaceAll('"', '""');
}

export function buildAdminClientCsvLines(history = [], nutritionDays = []) {
  const rows = [
    ["type", "date", "name", "calories", "protein", "fat", "carbs", "duration", "feedback"].join(",")
  ];

  (Array.isArray(history) ? history : []).forEach((item) => {
    rows.push([
      "workout",
      `"${escapeCsvText(item?.date || "")}"`,
      `"${escapeCsvText(item?.workout || "Тренировка")}"`,
      "",
      "",
      "",
      "",
      `"${escapeCsvText(item?.durationSeconds || "")}"`,
      `"${escapeCsvText(item?.postWorkoutFeedback?.title || item?.readiness?.title || "")}"`
    ].join(","));
  });

  (Array.isArray(nutritionDays) ? nutritionDays : []).forEach((day) => {
    rows.push([
      "nutrition",
      `"${escapeCsvText(day?.date || "")}"`,
      '"day totals"',
      Math.round(Number(day?.totals?.calories) || 0),
      Math.round(Number(day?.totals?.protein) || 0),
      Math.round(Number(day?.totals?.fat) || 0),
      Math.round(Number(day?.totals?.carbs) || 0),
      "",
      `"${escapeCsvText(`score ${day?.score ?? ""}`)}"`
    ].join(","));
  });

  return rows;
}

export function buildTrainerClientExportRows(history = [], measurements = [], nutritionDays = []) {
  const rows = [
    ["type", "date", "name", "calories", "protein", "fat", "carbs", "duration", "details"]
  ];

  (Array.isArray(history) ? history : []).forEach((item) => {
    rows.push([
      "workout",
      item?.date || item?.completedAt || "",
      item?.workoutName || item?.workout || item?.name || "Тренировка",
      "",
      "",
      "",
      "",
      item?.durationSeconds || "",
      item?.postWorkoutFeedback?.title || item?.readiness?.title || ""
    ]);
  });

  (Array.isArray(measurements) ? measurements : []).forEach((item) => {
    rows.push([
      "measurement",
      item?.date || item?.createdAt || "",
      "Замер",
      "",
      "",
      "",
      "",
      "",
      `weight ${item?.weight || item?.values?.weight || ""}`
    ]);
  });

  (Array.isArray(nutritionDays) ? nutritionDays : []).forEach((day) => {
    rows.push([
      "nutrition",
      day?.date || "",
      "day totals",
      Math.round(Number(day?.totals?.calories) || 0),
      Math.round(Number(day?.totals?.protein) || 0),
      Math.round(Number(day?.totals?.fat) || 0),
      Math.round(Number(day?.totals?.carbs) || 0),
      "",
      `score ${day?.score || ""}`
    ]);
  });

  return rows;
}

export function trainerExportRowsToCsv(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => (Array.isArray(row) ? row : [])
      .map((cell) => `"${escapeCsvText(cell)}"`)
      .join(","))
    .join("\n");
}

export function trainerExportRowsToHtmlRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .slice(1)
    .map((row) => `<tr>${(Array.isArray(row) ? row : [])
      .map((cell) => `<td>${String(cell).replace(/[<>&]/g, "")}</td>`)
      .join("")}</tr>`)
    .join("");
}
