import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const path = name => JSON.stringify(fileURLToPath(new URL(`../src/components/trainer/${name}.jsx`, import.meta.url)).replaceAll("\\", "/"));
const bundle = await rolldown({
  input: "library-ui-entry", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{ name: "library-ui-test-boundaries", resolveId(id) {
    if (["library-ui-entry", "react", "react/jsx-runtime", "lucide-react"].includes(id)) return id;
    if (id.endsWith(".module.css")) return "library-ui-styles";
    if (id.endsWith("/TrainerEditorSheet") || id === "./TrainerEditorSheet") return "library-ui-sheet";
    return null;
  }, load(id) {
    if (id === "library-ui-entry") return `export {default as Search} from ${path("TrainerExerciseLibrarySearch")};export {default as Picker} from ${path("TrainerExerciseLibraryPicker")};`;
    if (id === "react") return "export const useState=(...args)=>globalThis.__libraryUiHooks.useState(...args);export const useId=()=>globalThis.__libraryUiHooks.useId();";
    if (id === "react/jsx-runtime") return "export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;export const Fragment='fragment';";
    if (id === "lucide-react") return "export const ArrowUpRight='icon';export const Search='icon';export const Plus='icon';";
    if (id === "library-ui-styles") return "export default new Proxy({},{get:(_,key)=>key});";
    if (id === "library-ui-sheet") return "export default function Sheet(props){return {type:'dialog',props};}";
    return null;
  } }]
});
const generated = await bundle.generate({ format: "es" });
await bundle.close();
const { Search, Picker } = await import(`data:text/javascript,${encodeURIComponent(generated.output[0].code)}`);

function driver(Component, props) {
  const slots = [];
  let cursor;
  const expand = node => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.flatMap(item => expand(item));
    if (typeof node.type === "function") return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  const hooks = {
    useId() { const index = cursor++; return `library-ui-${index}`; },
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    }
  };
  return { props, render() { cursor = 0; globalThis.__libraryUiHooks = hooks; return expand(Component(props)); } };
}
function nodes(root, predicate) {
  if (!root || typeof root !== "object") return [];
  if (Array.isArray(root)) return root.flatMap(item => nodes(item, predicate));
  return [...(predicate(root) ? [root] : []), ...nodes(root.props?.children, predicate)];
}
const one = (root, predicate) => { const found = nodes(root, predicate); assert.equal(found.length, 1); return found[0]; };
const combo = root => one(root, node => node.props?.role === "combobox");
const options = root => nodes(root, node => node.props?.role === "option");
const content = node => typeof node === "string" ? node : Array.isArray(node) ? node.map(content).join(" ") : node && typeof node === "object" ? content(node.props?.children) : "";
const key = value => ({ key: value, preventDefault() {}, stopPropagation() {} });
const items = [
  { id: "leg", exerciseCardId: "card-leg", name: "Сгибание ног в тренажёре", video: "leg.mp4" },
  { id: "bench", exerciseCardId: "card-bench", name: "Жим в тренажёре", video: "bench.mp4" },
  { id: "deleted", name: "Удалённое упражнение", libraryDeletedAt: "2026-10-29" }
];

test("typing or clearing the name never renames an exercise or keeps old media under a new name", () => {
  const selected = [];
  const exercise = { id: "live", name: "Старое упражнение", video: "old.mp4", sets: [{ weight: 50, reps: 12 }] };
  const d = driver(Search, { exercise, items, onSelect: source => selected.push(source) });
  combo(d.render()).props.onChange({ target: { value: "Неизвестное название" } });
  assert.equal(options(d.render()).length, 0);
  assert.deepEqual(selected, []);
  assert.equal(exercise.name, "Старое упражнение");
  assert.equal(exercise.video, "old.mp4");
  combo(d.render()).props.onChange({ target: { value: "" } });
  assert.deepEqual(selected, []);
  combo(d.render()).props.onKeyDown(key("Escape"));
  assert.equal(combo(d.render()).props.value, exercise.name);
});

test("library choice works from the keyboard, ignores deleted items and passes the exact selected source", () => {
  let selected;
  const d = driver(Search, { exercise: { id: "live", name: "" }, items, onSelect: source => { selected = source; } });
  combo(d.render()).props.onChange({ target: { value: "сгибание тренажере" } });
  assert.equal(options(d.render()).length, 1);
  combo(d.render()).props.onKeyDown(key("Enter"));
  assert.equal(selected, items[0]);
  assert.equal(combo(d.render()).props["aria-expanded"], false);
});

test("no-match creation is delegated to the library and an unselected name resets when leaving the field", () => {
  let requested;
  const exercise = { id: "live", name: "Прежнее название" };
  const d = driver(Search, { exercise, items, onOpenLibrary: query => { requested = query; } });
  combo(d.render()).props.onChange({ target: { value: "Новый вариант" } });
  const link = one(d.render(), node => node.type === "button" && content(node).includes("Перейти в «Упражнения» и создать"));
  link.props.onClick();
  assert.equal(requested, "Новый вариант");
  d.render().props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null });
  assert.equal(combo(d.render()).props.value, exercise.name);
});

test("switching the edited exercise cannot inherit an unselected query; disabled search cannot select", () => {
  let selected = false;
  const d = driver(Search, { exercise: { id: "a", name: "Первое" }, items, onSelect: () => { selected = true; } });
  combo(d.render()).props.onChange({ target: { value: "Жим" } });
  d.props.exercise = { id: "b", name: "Второе" };
  d.props.disabled = true;
  assert.equal(combo(d.render()).props.value, "Второе");
  assert.equal(combo(d.render()).props["aria-expanded"], false);
  combo(d.render()).props.onKeyDown(key("Enter"));
  assert.equal(selected, false);
});

test("picker adds only a selected library item and never loads video media in search results", () => {
  const selected = [];
  const d = driver(Picker, { open: true, items, onClose() {}, onSelect: source => selected.push(source) });
  let tree = d.render();
  assert.equal(nodes(tree, node => node.type === "video" || node.type === "img").length, 0);
  const buttons = nodes(tree, node => node.props?.["aria-label"]?.startsWith("Добавить "));
  assert.equal(buttons.length, 2);
  assert.equal(selected.length, 0);
  buttons[0].props.onClick();
  assert.equal(selected[0], items[0]);
  tree = d.render();
  assert.ok(content(tree).includes("Добавлено: Сгибание ног"));
});
