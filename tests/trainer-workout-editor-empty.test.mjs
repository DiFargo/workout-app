import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium } from "playwright";

const workspacePath = fileURLToPath(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url)).replaceAll("\\", "/");
let workspaceSource = await readFile(workspacePath, "utf8");
// Red-phase fault injection affects only this in-memory test module. It never
// edits or rolls back the application's actual source.
if (process.env.TRAINER_WORKOUT_EDITOR_UNSAFE_BASELINE === "1") {
  const declaration = /const expandedLoadExerciseKey =[^;]+;/;
  assert.match(workspaceSource, declaration);
  workspaceSource = workspaceSource.replace(declaration, `const expandedLoadExerciseKey = expandedLoadExercise?.workoutId === selectedWorkout?.id
    ? expandedLoadExercise.exerciseKey
    : selectedWorkout?.exercises?.length ? String(selectedWorkout.exercises[0].id || 0) : "";`);
}

const bundle = await rolldown({
  input: "trainer-workout-editor-empty",
  platform: "browser",
  transform: { jsx: { runtime: "automatic" }, define: { "import.meta.env": JSON.stringify({ MODE: "test", DEV: false }) } },
  plugins: [{
    name: "trainer-workout-editor-empty",
    resolveId(id) {
      if (id === "trainer-workout-editor-empty" || id === "trainer-empty-firebase") return id;
      if (/\/firebase(?:\.js)?$/.test(id)) return "trainer-empty-firebase";
      return null;
    },
    load(id) {
      if (id === "trainer-empty-firebase") return "export const app={options:{}};export const auth={currentUser:null,onAuthStateChanged:()=>()=>{},onIdTokenChanged:()=>()=>{}};export const db={};export const storage={};export const functions={};";
      if (id.endsWith(".css")) return { moduleType: "js", code: "export default {};" };
      if (id.replaceAll("\\", "/") === workspacePath) return {
        moduleType: "jsx",
        code: `${workspaceSource}\nexport {TrainerWorkoutEditor as TestTrainerWorkoutEditor};`
      };
      if (id !== "trainer-workout-editor-empty") return null;
      return { moduleType: "jsx", code: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {flushSync} from 'react-dom';
        import {TestTrainerWorkoutEditor} from ${JSON.stringify(workspacePath)};
        window.editorProbe={errors:[]};
        class Boundary extends React.Component {
          state={failed:false};
          static getDerivedStateFromError(){return{failed:true};}
          componentDidCatch(error){window.editorProbe.errors.push({name:error.name,message:error.message});}
          render(){return this.state.failed?<output data-testid="editor-render-error">Ошибка редактора</output>:this.props.children;}
        }
        const root=createRoot(document.getElementById('root'));
        let props={embedded:true,showProgramControl:false,client:{id:'synthetic-client',name:'Тестовый клиент'},
          workouts:[],history:[],archivedWorkouts:[],exerciseLibrary:[],programTemplates:[]};
        window.editorProbe.render=patch=>{
          props={...props,...patch};
          flushSync(()=>root.render(<Boundary><TestTrainerWorkoutEditor {...props}/></Boundary>));
        };
      ` };
    }
  }]
});
const generated = await bundle.generate({ format: "iife", codeSplitting: false });
await bundle.close();

async function openEditor(browser) {
  const page = await browser.newPage();
  const bootErrors = [];
  page.on("pageerror", error => bootErrors.push(error.message));
  await page.setContent('<main id="root"></main>');
  await page.addScriptTag({ content: generated.output[0].code });
  assert.deepEqual(bootErrors, [], "тестовый модуль должен загрузиться до React-render");
  return page;
}

async function assertHealthyEmptyEditor(page) {
  assert.deepEqual(await page.evaluate(() => window.editorProbe.errors), [], "настоящий React-render не должен попадать в ErrorBoundary");
  assert.equal(await page.getByTestId("editor-render-error").count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Добавьте тренировочный день", exact: true }).count(), 1);
}

test("TrainerWorkoutEditor полностью отрисовывает пустой план при исходном null-раскрытии", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openEditor(browser);
    await page.evaluate(() => window.editorProbe.render({ workouts: [] }));
    await assertHealthyEmptyEditor(page);
    await page.evaluate(() => window.editorProbe.render({ embedded: false }));
    await assertHealthyEmptyEditor(page);
  } finally {
    await browser.close();
  }
});

test("исчезновение выбранной тренировки и устаревший initialWorkoutId не ломают полный render редактора", { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await openEditor(browser);
    await page.evaluate(() => window.editorProbe.render({ initialWorkoutId: "removed-workout",
      workouts: [{ id: "current-workout", name: "Тренировка 1", exercises: [] }] }));
    assert.deepEqual(await page.evaluate(() => window.editorProbe.errors), []);
    await page.evaluate(() => window.editorProbe.render({ workouts: [] }));
    await assertHealthyEmptyEditor(page);
  } finally {
    await browser.close();
  }
});
