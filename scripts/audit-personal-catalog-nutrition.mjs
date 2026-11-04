import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identity, normalize } from './lib/belarusPersonalCatalog.mjs';

// Offline triage only. This script never rewrites catalogue rows or queries a product API.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = {
  runtime: 'public/nutrition-catalog/personal/products.json',
  provenance: 'public/nutrition-catalog/personal/manufacturer-sources.json',
  full: 'output/belarus-products-10000/products.json',
  output: 'artifacts/nutrition-catalog-audit-2026-10-29/nutrition.json',
};
const nutrientKeys = ['kcal', 'protein', 'fat', 'carbs'];
const macroKeys = ['protein', 'fat', 'carbs'];
const epsilon = 1e-8;
const references = {
  energy: 'https://eur-lex.europa.eu/LexUriServ/LexUriServ.do?uri=OJ%3AL%3A2011%3A304%3A0018%3A0063%3Aen%3APDF',
  rounding: 'https://food.ec.europa.eu/system/files/2016-10/labelling_nutrition-supplements-guidance_tolerances_summary_table_012013_en.pdf',
  offSchema: 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/',
};
const rules = {
  invalid_numeric: { priority: 1, titleRussian: 'КБЖУ отсутствует, не является конечным числом или отрицательно' },
  unsupported_basis: { priority: 1, titleRussian: 'Неподдерживаемая единица КБЖУ' },
  unknown_basis: { priority: 2, titleRussian: 'Единица КБЖУ не раскрыта: проверка на 100 г не выполнена' },
  liquid_basis_requires_label: { priority: 2, titleRussian: 'Возможная жидкость: исходный базис 100 г или 100 мл требует этикетки' },
  existing_nutrition_conflict: { priority: 1, titleRussian: 'В исходной карточке уже отмечен конфликт КБЖУ' },
  member_numeric_invalid: { priority: 1, titleRussian: 'Нечисловое или отрицательное КБЖУ вложенного источника' },
  member_basis_disagreement: { priority: 2, titleRussian: 'Вложенные источники используют разные единицы' },
  member_nutrition_disagreement: { priority: 2, titleRussian: 'Вложенные источники содержат разные КБЖУ' },
  macro_mass_above_100_rounding_candidate: { priority: 2, titleRussian: 'Сумма БЖУ больше 100 г, но модель округления не исключает объяснение' },
  macro_mass_above_100_exceeds_rounding: { priority: 1, titleRussian: 'Сумма БЖУ больше 100 г даже при консервативном округлении' },
  macro_component_above_100: { priority: 1, titleRussian: 'Один макронутриент больше 100 г при заявленном базисе 100 г' },
  conditional_liquid_mass_anomaly: { priority: 2, titleRussian: 'Условная аномалия массы: сначала нужно установить 100 г или 100 мл' },
  energy_above_100g_factor_ceiling: { priority: 1, titleRussian: 'Энергия выше предела 100 г при использованных коэффициентах' },
  conditional_liquid_energy_ceiling: { priority: 2, titleRussian: 'Условная аномалия энергии: массовый базис жидкости не подтверждён' },
  energy_449_outside_rounding: { priority: 2, titleRussian: 'Энергия не совпадает с упрощённой формулой 4/9/4 после округления' },
  zero_energy_with_macros: { priority: 2, titleRussian: 'Нулевая энергия при ненулевых макронутриентах: требуется источник' },
  energy_without_macros: { priority: 2, titleRussian: 'Энергия есть, все БЖУ равны нулю: требуется источник' },
  energy_with_rounded_zero_macros: { priority: 3, titleRussian: 'Небольшая энергия при нулевых БЖУ совместима с моделью округления' },
  all_values_zero: { priority: 3, titleRussian: 'Все четыре значения равны нулю; это не всегда ошибка' },
  sample_extreme_value: { priority: 3, titleRussian: 'Максимум или минимальное положительное значение в проверяемой выборке' },
  name_fat_percent_mismatch: { priority: 2, titleRussian: 'Возможное противоречие жирности простого молочного продукта' },
  contradictory_preparation_markers: { priority: 2, titleRussian: 'Одно название содержит одновременно сырое и готовое состояние' },
  preparation_state_not_explicit: { priority: 3, titleRussian: 'Название чувствительного к приготовлению продукта не раскрывает состояние' },
  indistinguishable_name_different_nutrition: { priority: 2, titleRussian: 'Неразличимое после нормализации название имеет разные КБЖУ' },
};
const number = value => Math.round(value * 1e6) / 1e6;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const validNumbers = nutrition => nutrientKeys.every(key => Number.isFinite(nutrition?.[key]) && nutrition[key] >= 0);
const profile = nutrition => JSON.stringify([nutrition?.basis, ...nutrientKeys.map(key => nutrition?.[key])]);

// EC guidance: >=10 g rounds to 1 g; below 10 g to 0.1 g; declared 0 may mean <=0.5 g.
// This conservative envelope is a triage model, not a finding of legal non-compliance.
export function macroInterval(value) {
  const halfStep = value === 0 ? 0.5 : value >= 10 ? 0.5 : 0.05;
  return [Math.max(0, value - halfStep), value + halfStep];
}

function liquidSignals(row) {
  const name = normalize(row.name);
  const signals = [];
  const quantities = [row.quantity, ...(row.members || []).map(member => member.quantity)].filter(Boolean).join(' ');
  if (/(?:\d|\s)(?:мл|ml|cl|л|l)(?=\s|$)/iu.test(quantities)) signals.push('Объёмная единица в quantity исходного источника');
  if (/(?:\d|\s)(?:мл|ml|cl|л|l)(?=\s|$)/iu.test(row.name)) signals.push('Объёмная единица в названии');
  if (row.category === 'Напитки') signals.push('Категория «Напитки»; сама по себе не доказывает жидкое состояние');
  const dryOrSolid = /(?:сух(?:ой|ое|ая|ие)|порошок|сублимир|конфет|батончик|морожен|сгущенн|взбит)/u.test(name);
  if (!dryOrSolid && /^(?:напиток|сок |нектар|вода |водка|пиво|вино |квас|лимонад|молоко|кефир|ряженка|простокваша|айран|тан |сливки|milk |juice |water |drink )/u.test(`${name} `)) {
    signals.push('Название обычно жидкой продуктовой формы; требуется сверка конкретной этикетки');
  }
  if (!dryOrSolid && /(?:питьев|йогурт.*drink|drink.*йогурт)/u.test(name)) signals.push('Явный питьевой вариант в названии');
  if ((row.sources || []).some(source => /(?:\/|[-_])(?:juice|drink|beverage|water|milk)(?:\/|[-_])/iu.test(source.url || ''))) {
    signals.push('Жидкая форма предположительно отражена в URL источника');
  }
  return [...new Set(signals)];
}

function preparation(row) {
  const text = normalize(row.name);
  // «С сыром» is cheese, not raw food. «Вареники» is not a cooked-state marker.
  const raw = /(?:^|\s)сыр(?:ой|ое|ая|ые|ую|ого|ых)(?=\s|$)|(?:^|\s)в сыром виде(?=\s|$)/u.test(text);
  const cooked = /(?:^|\s)(?:отвар\p{L}*|варен(?!ик)\p{L}*|жарен\p{L}*|запеч\p{L}*|тушен\p{L}*|приготовлен\p{L}*|готов(?:ый|ое|ая|ые|ого|ом))(?=\s|$)/u.test(text);
  const dried = /(?:^|\s)(?:сух(?:ой|ое|ая|ие)|сушен\p{L}*)(?=\s|$)/u.test(text);
  const sensitive = /(?:^|\s)(?:рис|греч\p{L}*|макарон\p{L}*|круп\p{L}*|чечевиц\p{L}*|фасол\p{L}*|горох\p{L}*|филе|мясо|куриц\p{L}*|говядин\p{L}*|свинин\p{L}*|цыплен\p{L}*|шампиньон\p{L}*|картофел\p{L}*)(?=\s|$)/u.test(text);
  const state = raw && cooked ? 'противоречивые_маркеры' : raw ? 'сырой' : cooked ? 'приготовленный' : dried ? 'сухой_или_сушёный' : 'не_раскрыто_в_названии';
  return { state, sensitive, raw, cooked, dried };
}

function namedFat(row) {
  const text = normalize(row.name);
  const original = String(row.name || '').normalize('NFKC').toLowerCase();
  const percentages = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/gu)].map(match => ({ value: Number(match[1]), decimals: (match[1].split('.')[1] || '').length }));
  if (!percentages.length) return { status: 'процент_не_указан' };
  if (/сыр|сух\p{L}*\s+веществ/u.test(text)) return { status: 'проценты_сыра_не_приравнивались_к_граммам_жира', percentages: percentages.map(item => item.value) };
  if (/\d+(?:[.,]\d+)?\s*[-–—]\s*\d+(?:[.,]\d+)?\s*%|от\s+\d+(?:[.,]\d+)?\s+до\s+\d+(?:[.,]\d+)?\s*%/u.test(original)) {
    return { status: 'диапазон_жирности_не_приравнивался_к_одному_числу' };
  }
  if (percentages.length !== 1) return { status: 'неоднозначные_проценты_не_интерпретировались' };
  const simpleDairy = /^(?:био)?(?:кефир|молоко|сметана|сливки|творог|ряженка|простокваша|йогурт)(?=\s|$)/u.test(text);
  if (!simpleDairy || /(?:глазир|десерт|морожен|сух(?:ой|ое|ая|ие)|сгущенн|белка|протеин|protein|какао|шоколад|топпер)|^творог.*\sс\s/u.test(text)) {
    return { status: 'процент_не_трактовался_как_жирность_всего_продукта' };
  }
  const nominal = percentages[0];
  return { status: 'кандидат_на_сверку_массовой_жирности', nominalPercent: nominal.value, halfStep: 0.5 * 10 ** -nominal.decimals };
}

function sourceUrls(row) {
  return [...new Set((row.sources || []).map(source => source.url).filter(Boolean))];
}

export function auditRecord(row, context = {}) {
  const findings = [];
  const add = (code, reasonRussian, evidence = {}) => findings.push({ code, priority: rules[code].priority, reasonRussian, ...evidence });
  const nutrition = row.nutrition || {};
  const invalid = nutrientKeys.filter(key => !Number.isFinite(nutrition[key]) || nutrition[key] < 0);
  if (invalid.length) add('invalid_numeric', `Поля ${invalid.join(', ')} не содержат допустимые конечные неотрицательные числа.`, { fields: invalid });
  if (!['100g', 'unknown'].includes(nutrition.basis)) add('unsupported_basis', `Базис «${String(nutrition.basis)}» не поддерживается действующим каталогом.`);
  if (nutrition.basis === 'unknown') add('unknown_basis', 'Единица исходных значений не раскрыта. Масса на 100 г, энергия на 100 г и соответствие процента жирности числу граммов не оценивались.');
  const signals = liquidSignals(row);
  const liquidBasisRisk = row.sourceType === 'openfoodfacts' && nutrition.basis === '100g' && signals.length > 0;
  if (liquidBasisRisk) add('liquid_basis_requires_label', 'В OFF суффикс _100g может означать 100 мл жидкости. Старый импорт сохранял 100g без различения. Это риск единицы, а не установленная ошибка данного товара; пересчёт без этикетки и плотности запрещён.', { signals });
  if (row.nutritionConflict) add('existing_nutrition_conflict', 'В исходном наборе nutritionConflict=true. Каноническое КБЖУ нельзя считать согласованным между источниками.');
  const members = row.members || [];
  const badMembers = members.filter(member => !validNumbers(member.nutrition)).map(member => member.id);
  if (badMembers.length) add('member_numeric_invalid', 'У вложенных исходных записей есть недопустимые числовые значения.', { memberIds: badMembers });
  if (new Set(members.map(member => member.nutrition?.basis)).size > 1) add('member_basis_disagreement', 'Вложенные записи имеют разный базис; объединение само по себе не устанавливает единицу.');
  if (new Set(members.map(member => profile(member.nutrition))).size > 1) add('member_nutrition_disagreement', 'Вложенные источники не дают один и тот же вектор КБЖУ. Это может быть округление, рецептура, фасовка либо ошибочное объединение; нужна проверка источников.');

  const prep = preparation(row);
  if (prep.raw && prep.cooked) add('contradictory_preparation_markers', 'В одном названии встречаются маркеры сырого и приготовленного состояния. Если это не разные ингредиенты, карточка неоднозначна.');
  else if (prep.sensitive && !prep.raw && !prep.cooked && !prep.dried) add('preparation_state_not_explicit', 'Название не уточняет сырое, сухое либо приготовленное состояние. Для OFF данные по схеме относятся к продукту как продаётся; неверное КБЖУ из этого не следует.');

  const peers = context.peers || [];
  if (peers.length) add('indistinguishable_name_different_nutrition', 'У того же нормализованного бренда и названия есть другая карточка с иным КБЖУ. Нельзя автоматически выбирать значения или объединять карточки.', { otherIds: peers });
  const fatCheck = namedFat(row);
  let per100g = null;
  if (!invalid.length && nutrition.basis === '100g') {
    const intervals = Object.fromEntries(macroKeys.map(key => [key, macroInterval(nutrition[key])]));
    const sum = macroKeys.reduce((value, key) => value + nutrition[key], 0);
    const massLower = macroKeys.reduce((value, key) => value + intervals[key][0], 0);
    const massUpper = macroKeys.reduce((value, key) => value + intervals[key][1], 0);
    const energy449 = 4 * nutrition.protein + 9 * nutrition.fat + 4 * nutrition.carbs;
    const energyLower = 4 * intervals.protein[0] + 9 * intervals.fat[0] + 4 * intervals.carbs[0];
    const energyUpper = 4 * intervals.protein[1] + 9 * intervals.fat[1] + 4 * intervals.carbs[1];
    const energyOverlap = nutrition.kcal + 0.5 >= energyLower - epsilon && nutrition.kcal - 0.5 <= energyUpper + epsilon;
    per100g = {
      statusRussian: liquidBasisRisk ? 'Условные расчёты; базис жидкости не подтверждён этикеткой' : 'Внутренняя проверка при заявленном каталогом базисе 100 г',
      macroSum: number(sum), macroSumRoundingInterval: [number(massLower), number(massUpper)],
      energy449: number(energy449), energy449RoundingInterval: [number(energyLower), number(energyUpper)],
      declaredMinus449: number(nutrition.kcal - energy449), energyMatchesRoundingEnvelope: energyOverlap,
    };
    const above = macroKeys.filter(key => intervals[key][0] > 100 + epsilon);
    if (above.length) add(liquidBasisRisk ? 'conditional_liquid_mass_anomaly' : 'macro_component_above_100', 'Компонент БЖУ превышает массу 100 г даже с учётом модели округления. Для жидкости это условное наблюдение до уточнения единицы.', { fields: above });
    if (sum > 100 + epsilon) {
      const code = liquidBasisRisk ? 'conditional_liquid_mass_anomaly' : massLower > 100 + epsilon ? 'macro_mass_above_100_exceeds_rounding' : 'macro_mass_above_100_rounding_candidate';
      if (!findings.some(finding => finding.code === code)) add(code, massLower > 100 + epsilon
        ? 'Сумма БЖУ превышает 100 даже на нижней границе модели округления; арифметика несовместима с 100 г продукта. Это не сверка этикетки, а для жидкости сначала нужно подтвердить единицу.'
        : 'Сумма БЖУ превышает 100, однако нижняя граница модели округления не превышает 100. Это сомнение, а не подтверждённая физическая ошибка.');
    }
    if (nutrition.kcal - 0.5 > 100 * 9 + epsilon) add(liquidBasisRisk ? 'conditional_liquid_energy_ceiling' : 'energy_above_100g_factor_ceiling', 'Заявленная энергия выше 900 ккал: при массе 100 г и наибольшем коэффициенте 9 ккал/г это внутреннее противоречие. Для 100 мл такой массовый предел не применим без плотности.');
    if (!energyOverlap) add('energy_449_outside_rounding', 'Упрощённая оценка 4×Б+9×Ж+4×У не пересекается с округлённой энергией. Это не доказательство ошибки: клетчатка, полиолы, эритритол, спирт и органические кислоты имеют другие коэффициенты, а состав здесь неполон.');
    if (nutrition.kcal === 0 && macroKeys.some(key => nutrition[key] > 0.5)) add('zero_energy_with_macros', 'Энергия равна нулю, хотя есть БЖУ более 0,5 г. Полиолы, включая эритритол, не позволяют объявить это ошибкой без состава и этикетки.');
    if (nutrition.kcal > 0 && macroKeys.every(key => nutrition[key] === 0)) {
      add(energyOverlap ? 'energy_with_rounded_zero_macros' : 'energy_without_macros', energyOverlap
        ? 'Ненулевая энергия при объявленных нулевых БЖУ не противоречит принятой модели округления. Истинность конкретной этикетки этим не установлена.'
        : 'Положительная энергия при нулевых БЖУ может отражать спирт, кислоты, клетчатку либо неполные данные; автоматически восстанавливать БЖУ нельзя.');
    }
    if (nutrientKeys.every(key => nutrition[key] === 0)) add('all_values_zero', 'Все четыре значения нулевые. Это допустимо, например, для воды; соответствие конкретному продукту этикеткой не проверялось.');
    const extreme = nutrientKeys.filter(key => context.extremes?.[key] && (nutrition[key] === context.extremes[key].max || nutrition[key] > 0 && nutrition[key] === context.extremes[key].minPositive));
    if (extreme.length) add('sample_extreme_value', 'Значение совпадает с максимумом либо минимальным положительным значением этого поля в исходных карточках 100g. Это относительный экстремум выборки, не нормативный порог и не доказательство ошибки.', { fields: extreme });
    if (fatCheck.nominalPercent !== undefined) {
      const [fatLower, fatUpper] = intervals.fat;
      const mismatch = fatUpper < fatCheck.nominalPercent - fatCheck.halfStep - epsilon || fatLower > fatCheck.nominalPercent + fatCheck.halfStep + epsilon;
      fatCheck.status = mismatch ? 'нужно_сверить_название_и_жирность' : 'интервалы_жирности_не_противоречат_названию';
      if (mismatch) add('name_fat_percent_mismatch', 'У простого молочного продукта процент в названии не согласуется с жиром на заявленные 100 г в пределах модели округления. Это кандидат на сверку этикетки; для жидкости сначала подтвердить массовый базис.', { nominalPercent: fatCheck.nominalPercent, catalogFat: nutrition.fat });
    }
  } else if (fatCheck.nominalPercent !== undefined) {
    fatCheck.status = 'не_проверялось_без_известного_базиса_и_допустимых_чисел';
  }
  const definiteCodes = new Set(['invalid_numeric', 'unsupported_basis', 'member_numeric_invalid', 'macro_component_above_100', 'macro_mass_above_100_exceeds_rounding', 'energy_above_100g_factor_ceiling']);
  const recordStatus = findings.some(finding => definiteCodes.has(finding.code)) ? 'внутреннее_противоречие_данных'
    : nutrition.basis === 'unknown' ? 'не_проверено_из_за_неизвестного_базиса'
      : liquidBasisRisk ? 'требует_подтверждения_базиса_жидкости'
        : findings.some(finding => finding.priority <= 2) ? 'требует_проверки_источника'
          : 'явных_внутренних_аномалий_не_найдено';
  const priority = findings.length ? Math.min(...findings.map(finding => finding.priority)) : 3;
  const reasonRussian = recordStatus === 'не_проверено_из_за_неизвестного_базиса'
    ? 'КБЖУ не подтверждено: неизвестна единица, поэтому проверки на 100 г пропущены. Прочие замечания приведены отдельно.'
    : recordStatus === 'явных_внутренних_аномалий_не_найдено'
      ? 'Внутренние проверки не выявили явного противоречия. Это не подтверждает правильность КБЖУ по официальной этикетке.'
      : findings.filter(finding => finding.priority <= 2).map(finding => finding.reasonRussian).join(' ');
  return {
    id: row.id, name: row.name, brand: row.brand, category: row.category, sourceType: row.sourceType,
    nutrition, recordStatus, priority, reasonRussian,
    officialLabelCheck: { status: 'не_выполнена', reasonRussian: 'Этот проход анализирует сохранённые данные, а не проверяет этикетку каждого SKU на сайте производителя.' },
    sourceNutritionConflict: Boolean(row.nutritionConflict), sourceUrls: sourceUrls(row),
    zeroFields: nutrientKeys.filter(key => nutrition[key] === 0), per100g,
    preparationState: prep.state, fatPercentCheck: fatCheck, findings,
    ...(members.length > 1 ? { memberNutritionProfiles: members.map(member => ({ id: member.id, name: member.name, nutrition: member.nutrition })) } : {}),
  };
}

function extrema(rows) {
  return Object.fromEntries(nutrientKeys.map(key => {
    const values = rows.filter(row => row.nutrition?.basis === '100g' && validNumbers(row.nutrition)).map(row => row.nutrition[key]);
    return [key, { min: Math.min(...values), minPositive: Math.min(...values.filter(value => value > 0)), max: Math.max(...values) }];
  }));
}

export function buildReport(rows, baseline, inputs) {
  const groups = new Map();
  for (const row of rows) {
    const key = identity(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const extremes = extrema(rows);
  const records = rows.map((row, index) => {
    const peers = groups.get(identity(row)).filter(other => other.id !== row.id && profile(other.nutrition) !== profile(row.nutrition)).map(other => other.id);
    return { baselineIndex: index, ...auditRecord(row, { peers, extremes }) };
  });
  const countBy = key => records.reduce((counts, row) => ({ ...counts, [row[key]]: (counts[row[key]] || 0) + 1 }), {});
  const ruleCounts = Object.fromEntries(Object.entries(rules).map(([code, rule]) => [code, { ...rule, count: records.filter(row => row.findings.some(finding => finding.code === code)).length }]));
  return {
    schemaVersion: 1, checkedAt: '2026-10-29', modeRussian: 'Офлайн-аудит исходных 10000 карточек без исправлений и удаления',
    scopeRussian: 'Ровно замороженный runtime-prefix baseline.count; новые карточки производителя в этот аудит не входят.',
    baseline, inputs, totalRecords: records.length, uniqueIds: new Set(records.map(row => row.id)).size,
    coverage: { everyBaselineIdHasIndividualResult: records.length === baseline.count, officialLabelsIndividuallyChecked: 0, noCatalogueChanges: true },
    priorityLegendRussian: { 1: 'Первая очередь: внутреннее противоречие или уже отмеченный конфликт источников', 2: 'Вторая очередь: уточнить единицу, состояние либо первичный источник', 3: 'Информация или отсутствие явной внутренней аномалии; этикетка не подтверждена' },
    methodology: {
      references,
      energyRussian: '4/9/4 — упрощённая проверка согласованности. Annex XIV также содержит коэффициенты для полиолов, клетчатки, эритритола, спирта и органических кислот; отсутствующие компоненты не восстанавливаются.',
      roundingRussian: 'Консервативная модель: БЖУ >=10 г — ±0,5 г; 0<БЖУ<10 г — ±0,05 г; объявленный ноль — 0..0,5 г; энергия — ±0,5 ккал. Это модель отбора сомнений, не признание этикетки соответствующей закону и не применение норм ЕС к Беларуси.',
      massRussian: 'Для заявленных 100 г проверяется сумма БЖУ и компоненты. Сумма >100, объяснимая моделью округления, отделена от превышения нижней границы. Для возможных жидкостей вывод условен до установления 100 г/100 мл.',
      unitRussian: 'Unknown исключён из всех расчётов на 100 г. В OFF _100g может означать 100 мл жидкости. Эвристические сигналы определяют кандидатов на сверку, а не число доказанных ошибок единицы.',
      stateRussian: 'Сырое/готовое состояние проверяется только по названию; рецепт, выход блюда и изменение воды не угадываются. Разные ингредиенты могут объяснять совместные маркеры.',
      percentRussian: 'Проценты сыра не сравниваются с граммами жира. Для простых молочных продуктов выделяются лишь кандидаты на сверку; составные продукты, неоднозначные проценты и неизвестный базис исключены.',
      extremeRussian: 'Экстремумы — минимум, минимальное положительное и максимум фактической выборки 100g. Порогов из калорийных агрегаторов нет.',
    },
    limitationsRussian: [
      'Охват 10000/10000 означает индивидуальную машинную проверку сохранённых данных, а не проверку 10000 официальных этикеток.',
      'Проход не устанавливает истинность AI-источников, правильность перевода, соответствие бренда изготовителю и фактическую доступность на рынке.',
      'Пределы на 100 г зависят от правильного базиса; сомнительная единица жидкости не исправлялась и плотность не предполагалась.',
      'Поиск возможных жидкостей эвристический: неверная категория, неполное название или отсутствие единицы объёма могут скрыть другие случаи. Число кандидатов не является точным числом жидкостей или ошибок.',
      'Отклонение энергии от 4/9/4 — повод проверить состав и исходную этикетку, не автоматическое основание удалить карточку.',
      'Исходная точность отображения чисел утрачена в JSON; интервал округления является консервативной моделью, а не доказанным допуском конкретной упаковки.',
      'Названия без состояния и совпадающие нормализованные названия могут относиться к законным вариантам рецептуры или фасовки; автоматического объединения нет.',
      'Проверены конечность и неотрицательность вложенных КБЖУ; подробная физическая проверка относится к каноническому КБЖУ каждой из 10000 карточек.',
    ],
    summary: {
      recordStatusCounts: countBy('recordStatus'), priorityCounts: countBy('priority'), basisCounts: rows.reduce((counts, row) => ({ ...counts, [row.nutrition?.basis]: (counts[row.nutrition?.basis] || 0) + 1 }), {}),
      existingNutritionConflictCount: rows.filter(row => row.nutritionConflict).length,
      unknownBasisPer100gChecksSkipped: records.filter(row => row.nutrition.basis === 'unknown' && row.per100g === null).length,
      liquidCandidatesNotProvenUnitErrors: ruleCounts.liquid_basis_requires_label.count,
      knownBasisWithAtLeastOneZeroField: records.filter(row => row.nutrition.basis === '100g' && row.zeroFields.length).length,
      allBasisWithAtLeastOneZeroField: records.filter(row => row.zeroFields.length).length,
      sourceTypes: rows.reduce((counts, row) => ({ ...counts, [row.sourceType]: (counts[row.sourceType] || 0) + 1 }), {}),
      extremes,
    },
    ruleCounts, records,
  };
}

function selfTest() {
  const row = (nutrition, name = 'Продукт', sourceType = 'openfoodfacts') => ({ id: 'test', name, brand: '', category: '', sourceType, nutrition, members: [] });
  const codes = result => result.findings.map(finding => finding.code);
  const unknown = auditRecord(row({ basis: 'unknown', kcal: 5000, protein: 200, fat: 100, carbs: 100 }));
  assert.equal(unknown.per100g, null);
  assert.deepEqual(codes(unknown), ['unknown_basis']);
  assert.ok(codes(auditRecord(row({ basis: '100g', kcal: 400, protein: 50.3, fat: 0, carbs: 50.3 }))).includes('macro_mass_above_100_rounding_candidate'));
  assert.ok(codes(auditRecord(row({ basis: '100g', kcal: 400, protein: 60, fat: 0, carbs: 50 }))).includes('macro_mass_above_100_exceeds_rounding'));
  assert.ok(!codes(auditRecord(row({ basis: '100g', kcal: 330, protein: 25, fat: 26, carbs: 0 }, 'Сыр 45%'))).includes('name_fat_percent_mismatch'));
  assert.ok(codes(auditRecord(row({ basis: '100g', kcal: 50, protein: 3, fat: 25, carbs: 4 }, 'Кефир 2,5%'))).includes('name_fat_percent_mismatch'));
  const liquid = auditRecord(row({ basis: '100g', kcal: 1000, protein: 0, fat: 110, carbs: 0 }, 'Масло растительное 500 мл'));
  assert.ok(codes(liquid).includes('liquid_basis_requires_label'));
  assert.ok(codes(liquid).includes('conditional_liquid_mass_anomaly'));
  assert.ok(!codes(liquid).includes('macro_component_above_100'));
  assert.ok(codes(auditRecord(row({ basis: 'unknown', kcal: 140, protein: 25, fat: 3, carbs: 0 }, 'Филе индейки сырое запеченное'))).includes('contradictory_preparation_markers'));
  assert.ok(!codes(auditRecord(row({ basis: 'unknown', kcal: 200, protein: 8, fat: 10, carbs: 20 }, 'Макароны отварные с сыром готовые'))).includes('contradictory_preparation_markers'));
  assert.ok(!codes(auditRecord(row({ basis: '100g', kcal: 60, protein: 3, fat: 3.4, carbs: 4.7 }, 'Молоко 3,4-6,0%'))).includes('name_fat_percent_mismatch'));
  assert.ok(!codes(auditRecord(row({ basis: '100g', kcal: 53.2, protein: 5.8, fat: 2, carbs: 3 }, 'Йогурт питьевой натуральный 2%', 'manufacturer'))).includes('liquid_basis_requires_label'));
  const numeric = auditRecord(row({ basis: '100g', kcal: Number.NaN, protein: 0, fat: -1, carbs: 0 }));
  assert.ok(codes(numeric).includes('invalid_numeric'));
  const energy = auditRecord(row({ basis: '100g', kcal: 100, protein: 0, fat: 0, carbs: 0 }));
  assert.equal(energy.recordStatus, 'требует_проверки_источника');
  console.log('Профильные проверки аудита: 12 сценариев пройдены.');
}

function main() {
  const args = process.argv.slice(2);
  assert.ok(args.every(arg => ['--check', '--self-test'].includes(arg)), 'Поддерживаются только --check и --self-test');
  if (args.includes('--self-test')) { selfTest(); return; }
  const before = Object.fromEntries(['runtime', 'provenance', 'full'].map(key => [key, digest(fs.readFileSync(path.join(root, paths[key])))]));
  const runtime = read(paths.runtime);
  const baseline = read(paths.provenance).baseline;
  const rows = read(paths.full);
  assert.equal(baseline.count, 10000, 'Ожидается замороженная база из 10000 карточек');
  assert.equal(rows.length, baseline.count);
  assert.equal(digest(JSON.stringify(runtime.slice(0, baseline.count))), baseline.rowsSha256, 'Runtime-prefix отличается от замороженной базы');
  assert.equal(new Set(rows.map(row => row.id)).size, baseline.count, 'Повтор ID в исходных 10000');
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], n = row.nutrition;
    assert.deepEqual([row.id, row.name, row.brand, row.category, n.kcal, n.protein, n.fat, n.carbs, n.basis], runtime[index].slice(0, 9), `Исходные данные и runtime-prefix различаются: ${index}`);
    assert.equal(Boolean(row.nutritionConflict), Boolean(runtime[index][13]), `Разный nutritionConflict: ${row.id}`);
  }
  const inputs = Object.fromEntries(['runtime', 'provenance', 'full'].map(key => [key, { path: paths[key], sha256: before[key] }]));
  const report = buildReport(rows, baseline, inputs);
  assert.equal(report.records.length, baseline.count);
  assert.equal(report.uniqueIds, baseline.count);
  for (const result of report.records) {
    if (result.nutrition.basis === 'unknown') assert.equal(result.per100g, null);
    assert.equal(typeof result.reasonRussian, 'string');
    assert.ok([1, 2, 3].includes(result.priority));
  }
  const encoded = JSON.stringify(report, null, 2) + '\n';
  const output = path.join(root, paths.output);
  if (args.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), encoded, 'Сохранённый отчёт не воспроизводится');
  else { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, encoded); }
  for (const key of Object.keys(before)) assert.equal(digest(fs.readFileSync(path.join(root, paths[key]))), before[key], `Входной файл изменился во время аудита: ${paths[key]}`);
  console.log(JSON.stringify({ output: paths.output, totalRecords: report.totalRecords, summary: report.summary, ruleCounts: report.ruleCounts }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
