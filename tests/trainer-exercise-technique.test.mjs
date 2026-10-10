import test from "node:test";
import assert from "node:assert/strict";
import { getTrainerExerciseTechniqueGuide } from "../src/utils/trainerExerciseTechnique.js";
import { getBasicWorkoutExerciseTechniqueHint } from "../src/utils/basicWorkoutExercisePresentation.js";

const trainerExerciseNames = [
  "Тяга нижнего блока", "Выпады с гантелями", "Выпады в тренажёре Смита",
  "Тяга верхнего блока узким хватом", "Тяга нижнего блока широким хватом", "Жим гантелей сидя",
  "Жим лёжа со штангой", "Жим ногами", "Сгибание ног в тренажере", "Разведение ног в тренажере",
  "Тяга верхнего блока", "Ягодичный мост в тренажере", "Тяга верхнего хаммера", "Жим хаммера на низ груди",
  "Жим лёжа с гантелями на наклонной скамье", "Тяга хаммера по одной руке", "Жим лёжа на наклонной скамье со штангой",
  "Разгибание ног в тренажёре", "Тяга гантели с опорой на скамью", "Жим лёжа с гантелями", "Сведение ног в тренажере",
  "Сведение рук с гантелями лёжа", "Жим сидя в тренажёре на грудь", "Тяга верхнего блока обратным хватом",
  "Тяга нижнего хаммера", "Приседания в тренажёре Смита", "Тяга нижнего блока по одной руке",
  "Румынская тяга со штангой", "Свидение рук в тренажёре бабочка", "Свеление рук с гантелями на наклонной скамье",
  "Разведение ног в тренажёре с наклоном корпуса вперёд", "Гиперэкстензия с диском",
  "Тяга Т-грифа с упором грудью широким хватом", "Тяга Т-грифа с упором грудью нейтральным хватом",
  "Тяга рычажного тренажёра одной рукой с упором грудью", "Тяга штанги в наклоне",
  "Сведение рук в кроссовере снизу вверх", "Отжимания на брусьях", "Отжимания от грифа в тренажёре Смита", "Отжимания от пола"
];

test("every current trainer exercise has a movement-specific three-step technique guide", () => {
  for (const name of trainerExerciseNames) {
    const guide = getTrainerExerciseTechniqueGuide(name);
    assert.ok(guide, `No technique guide for ${name}`);
    assert.match(guide, /^1\. /);
    assert.match(guide, /\n2\. /);
    assert.match(guide, /\n3\. /);
    assert.doesNotMatch(guide, /сохраняй устойчивое положение и выполняй повторения в безболезненной амплитуде/);
  }
});

test("trainer-authored technique remains preferred over the generated guide", () => {
  const authoredText = "Тренерская подсказка: держи локти ближе к корпусу.";
  assert.equal(
    getBasicWorkoutExerciseTechniqueHint({ exerciseCardId: "card-1", name: "Жим ногами", technique: authoredText }, getTrainerExerciseTechniqueGuide("Жим ногами")),
    authoredText
  );
  assert.match(
    getBasicWorkoutExerciseTechniqueHint({ exerciseCardId: "card-1", name: "Жим ногами" }, getTrainerExerciseTechniqueGuide("Жим ногами")),
    /Поставь стопы на платформу/
  );
});
