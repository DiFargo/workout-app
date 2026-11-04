import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { transform } from "lightningcss";

const componentPath = fileURLToPath(new URL("../src/components/trainer/TrainerLibraryExercisePreview.jsx", import.meta.url)).replaceAll("\\", "/");
const bundle = await rolldown({
  input: "library-preview-entry", platform: "browser", transform: { jsx: { runtime: "automatic" } },
  plugins: [{ name: "library-preview-boundaries", resolveId(id) {
    if (["library-preview-entry", "react", "react/jsx-runtime", "lucide-react"].includes(id)) return id;
    if (id.endsWith("/protectedExerciseVideo")) return "preview-access";
    if (id.endsWith("/ProtectedExerciseVideo")) return "preview-video";
    if (id.endsWith(".module.css")) return "preview-styles";
    return null;
  }, load(id) {
    if (id === "library-preview-entry") return `export {default} from ${JSON.stringify(componentPath)};`;
    if (id === "react") return "export const memo=value=>value;export const useState=(...args)=>globalThis.__previewHooks.useState(...args);export const useRef=(...args)=>globalThis.__previewHooks.useRef(...args);export const useEffect=(...args)=>globalThis.__previewHooks.useEffect(...args);";
    if (id === "react/jsx-runtime") return "export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;";
    if (id === "lucide-react") return "export const Dumbbell='svg';";
    if (id === "preview-styles") return "export default {preview:'preview',media:'media'};";
    if (id === "preview-access") return "export const protectedExerciseVideoAccess={isProtected:source=>source.startsWith('gs://')};";
    if (id === "preview-video") return "export default function Video(props){return {type:'protected-video',props};}";
    return null;
  } }]
});
const generated = await bundle.generate({ format: "es" });
await bundle.close();
const { default: Preview } = await import(`data:text/javascript,${encodeURIComponent(generated.output[0].code)}`);

function fixture(props, { observer = true, initialTop = 2000 } = {}) {
  const originals = new Map(["IntersectionObserver", "window", "document"].map(key => [key, globalThis[key]]));
  const observers = [];
  const handlers = new Map();
  const slots = [];
  const effects = [];
  let cursor;
  let top = initialTop;
  const element = { getBoundingClientRect: () => ({ top, bottom: top + 64, left: 0, right: 64 }) };
  globalThis.IntersectionObserver = observer ? class {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe(node) { this.node = node; }
    disconnect() { this.disconnected = true; }
  } : undefined;
  const events = {
    addEventListener(type, callback) { handlers.set(type, callback); },
    removeEventListener(type, callback) { if (handlers.get(type) === callback) handlers.delete(type); }
  };
  globalThis.window = { ...events, innerHeight: 874, innerWidth: 402,
    requestAnimationFrame(callback) { callback(); return 1; }, cancelAnimationFrame() {} };
  globalThis.document = { ...events };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) {
        slots[index]?.cleanup?.();
        slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = callback(); });
      }
    }
  };
  function expand(node) {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(expand);
    if (typeof node.type === "function") return expand(node.type(node.props));
    if (node.props?.ref) node.props.ref.current = element;
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  }
  return {
    observers,
    render() { cursor = 0; globalThis.__previewHooks = hooks; const tree = expand(Preview(props)); effects.splice(0).forEach(effect => effect()); return tree; },
    intersect(value) { observers[0].callback([{ isIntersecting: value }]); },
    scrollTo(value) { top = value; handlers.get("scroll")?.(); },
    dispose() {
      slots.forEach(slot => slot?.cleanup?.());
      for (const [key, original] of originals) { if (original === undefined) delete globalThis[key]; else globalThis[key] = original; }
      delete globalThis.__previewHooks;
    }
  };
}
function nodes(root, type) {
  if (!root || typeof root !== "object") return [];
  if (Array.isArray(root)) return root.flatMap(node => nodes(node, type));
  return [...(root.type === type ? [root] : []), ...nodes(root.props?.children, type)];
}

test("library thumbnails defer protected poster-only access until nearby and unmount it when out of view", () => {
  const ui = fixture({ video: "gs://test/leg.mp4", previewTime: 4.5 });
  try {
    assert.equal(nodes(ui.render(), "protected-video").length, 0);
    assert.equal(ui.observers[0].options.rootMargin, "120px");
    ui.intersect(true);
    const tree = ui.render();
    assert.equal(tree.props.inert, true);
    assert.equal(tree.props["aria-hidden"], "true");
    assert.equal(nodes(tree, "svg").length, 1);
    const [video] = nodes(tree, "protected-video");
    assert.equal(video.props.src, "gs://test/leg.mp4");
    assert.equal(video.props.previewTime, 4.5);
    assert.equal(video.props.preferPoster, true);
    assert.equal(video.props.preload, "none");
    assert.equal(video.props.controls, false);
    assert.equal(video.props.tabIndex, -1);
    ui.intersect(false);
    assert.equal(nodes(ui.render(), "protected-video").length, 0);
  } finally { ui.dispose(); }
  assert.equal(ui.observers[0].disconnected, true);
});

test("public videos without a poster never mount media; a failed explicit image returns to the icon", () => {
  const props = { video: "https://public.invalid/video.mp4" };
  const ui = fixture(props);
  try {
    ui.render(); ui.intersect(true);
    let tree = ui.render();
    assert.equal(nodes(tree, "protected-video").length, 0);
    assert.equal(nodes(tree, "img").length, 0);
    props.poster = "https://public.invalid/preview.webp";
    tree = ui.render();
    const [image] = nodes(tree, "img");
    assert.equal(image.props.src, props.poster);
    assert.equal(image.props.loading, "lazy");
    assert.equal(image.props.alt, "");
    image.props.onError();
    tree = ui.render();
    assert.equal(nodes(tree, "img").length, 0);
    assert.equal(nodes(tree, "svg").length, 1);
    assert.equal(nodes(tree, "protected-video").length, 0);
  } finally { ui.dispose(); }
});

test("WebViews without IntersectionObserver still defer off-screen posters and clean up listeners", () => {
  const ui = fixture({ video: "gs://test/leg.mp4" }, { observer: false });
  try {
    ui.render();
    assert.equal(nodes(ui.render(), "protected-video").length, 0);
    ui.scrollTo(100);
    assert.equal(nodes(ui.render(), "protected-video").length, 1);
  } finally { ui.dispose(); }
});

test("thumbnail stylesheet parses with local video and failure-message isolation", () => {
  const path = new URL("../src/components/trainer/TrainerLibraryExercisePreview.module.css", import.meta.url);
  assert.ok(transform({ filename: fileURLToPath(path), code: readFileSync(path), cssModules: true }).code.length);
});
