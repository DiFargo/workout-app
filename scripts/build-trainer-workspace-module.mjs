import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import postcss from "postcss";

const traverse = traverseModule.default || traverseModule;
const rootDirectory = process.cwd();
const componentPath = path.join(rootDirectory, "src/components/trainer/TrainerWorkspace.jsx");
const legacyEntryPath = path.join(rootDirectory, "src/styles/trainer-lazy.css");
const outputPath = path.join(rootDirectory, "src/components/trainer/TrainerWorkspace.module.css");
const classPattern = /\.([_a-zA-Z][\w-]*)/g;
const idPattern = /#([_a-zA-Z][\w-]*)/g;
const unreachableClassPrefixes = ["trainerMessage"];

function isReachableSelector(selector) {
  return !selectorClasses(selector).some((className) => (
    unreachableClassPrefixes.some((prefix) => className.startsWith(prefix))
  ));
}

function splitSelectors(selectorList) {
  const selectors = [];
  let current = "";
  let roundDepth = 0;
  let squareDepth = 0;

  for (const character of selectorList) {
    if (character === "(" ) roundDepth += 1;
    if (character === ")" ) roundDepth -= 1;
    if (character === "[") squareDepth += 1;
    if (character === "]") squareDepth -= 1;

    if (character === "," && roundDepth === 0 && squareDepth === 0) {
      selectors.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  if (current.trim()) selectors.push(current.trim());
  return selectors;
}

function selectorClasses(selector) {
  return [...selector.matchAll(classPattern)].map((match) => match[1]);
}

function addClassTokens(value, target) {
  String(value || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => target.add(token));
}

function collectComponentClasses(source, cssClasses) {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["jsx"]
  });
  const classes = new Set();

  traverse(ast, {
    JSXAttribute(attributePath) {
      if (attributePath.node.name?.name !== "className") return;
      const valuePath = attributePath.get("value");

      if (valuePath.isStringLiteral()) {
        addClassTokens(valuePath.node.value, classes);
        return;
      }

      valuePath.traverse({
        StringLiteral(stringPath) {
          addClassTokens(stringPath.node.value, classes);
        },
        TemplateElement(templatePath) {
          addClassTokens(templatePath.node.value.cooked, classes);
        }
      });
    },
    StringLiteral(stringPath) {
      const value = stringPath.node.value.trim();
      if (cssClasses.has(value)) classes.add(value);
    }
  });

  return new Set([...classes].filter((className) => cssClasses.has(className)));
}

function resolveImportPath(importerPath, request) {
  const resolved = path.resolve(path.dirname(importerPath), request);
  return path.extname(resolved) ? resolved : `${resolved}.css`;
}

function expandCssFile(filePath, stack = []) {
  if (stack.includes(filePath)) {
    throw new Error(`CSS import cycle: ${[...stack, filePath].join(" -> ")}`);
  }

  const css = fs.readFileSync(filePath, "utf8");
  const parsed = postcss.parse(css, { from: filePath });
  const expanded = postcss.root();

  for (const node of parsed.nodes) {
    if (node.type === "atrule" && node.name === "import") {
      const match = node.params.match(/^["']([^"']+)["']/);
      if (!match) continue;
      const importedPath = resolveImportPath(filePath, match[1]);
      const importedRoot = expandCssFile(importedPath, [...stack, filePath]);
      importedRoot.each((importedNode) => expanded.append(importedNode.clone()));
      continue;
    }

    expanded.append(node.clone());
  }

  return expanded;
}

function scopeSelector(selector, anchorClasses) {
  const classes = selectorClasses(selector);
  const anchorClass = classes.includes("trainerNextRoot")
    ? "trainerNextRoot"
    : classes.find((className) => anchorClasses.has(className));

  if (!anchorClass) return null;

  let scoped = selector.replace(idPattern, (_match, id) => `:global(#${id})`);
  scoped = scoped.replace(classPattern, (_match, className) => `:global(.${className})`);

  const anchor = `:global(.${anchorClass})`;
  return anchorClass === "trainerNextRoot"
    ? scoped.replace(anchor, `:where(.scope)${anchor}`)
    : scoped.replace(anchor, `:where(.scope) ${anchor}`);
}

function isInsideKeyframes(rule) {
  let current = rule.parent;
  while (current) {
    if (current.type === "atrule" && /keyframes$/i.test(current.name)) return true;
    current = current.parent;
  }
  return false;
}

function removeEmptyContainers(root) {
  let removed = true;
  while (removed) {
    removed = false;
    root.walkAtRules((atRule) => {
      if (atRule.nodes && atRule.nodes.length === 0) {
        atRule.remove();
        removed = true;
      }
    });
  }
}

const expandedRoot = expandCssFile(legacyEntryPath);
const cssClasses = new Set();
expandedRoot.walkRules((rule) => {
  if (!isInsideKeyframes(rule)) {
    selectorClasses(rule.selector).forEach((className) => cssClasses.add(className));
  }
});

const componentSource = fs.readFileSync(componentPath, "utf8");
const usedClasses = collectComponentClasses(componentSource, cssClasses);
const anchorClasses = new Set([...usedClasses].filter((className) => className.startsWith("trainer")));
const outputRoot = expandedRoot.clone();
let keptSelectorCount = 0;
let removedImportantCount = 0;

outputRoot.walkComments((comment) => comment.remove());
outputRoot.walkRules((rule) => {
  if (isInsideKeyframes(rule)) return;

  const scopedSelectors = splitSelectors(rule.selector)
    .filter(isReachableSelector)
    .filter((selector) => selectorClasses(selector).some((className) => anchorClasses.has(className)))
    .map((selector) => scopeSelector(selector, anchorClasses))
    .filter(Boolean);

  if (!scopedSelectors.length) {
    rule.remove();
    return;
  }

  keptSelectorCount += scopedSelectors.length;
  rule.selector = scopedSelectors.join(",\n");
  rule.walkDecls((declaration) => {
    if (declaration.important) {
      declaration.important = false;
      removedImportantCount += 1;
    }
  });
});

const activeCssText = outputRoot.toString();
outputRoot.walkAtRules((atRule) => {
  if (!/keyframes$/i.test(atRule.name)) return;
  const animationName = atRule.params.trim();
  if (!animationName || !activeCssText.includes(animationName)) atRule.remove();
});
removeEmptyContainers(outputRoot);

const groupedRoot = postcss.root();
let previousSource = "";
for (const node of outputRoot.nodes) {
  const sourceFile = node.source?.input?.file || legacyEntryPath;
  const relativeSource = path.relative(rootDirectory, sourceFile).replaceAll("\\", "/");
  if (relativeSource !== previousSource) {
    groupedRoot.append(postcss.comment({ text: `Migrated from ${relativeSource}` }));
    previousSource = relativeSource;
  }
  groupedRoot.append(node.clone());
}

const header = `/*
 * Scoped styles for the reachable TrainerWorkspace UI.
 * Generated from the current production cascade, then reviewed in this module.
 * Selectors without a TrainerWorkspace class are intentionally excluded.
 */\n`;
fs.writeFileSync(outputPath, `${header}${groupedRoot.toString()}\n`, "utf8");

const outputLines = fs.readFileSync(outputPath, "utf8").split(/\r?\n/).length;
console.log(JSON.stringify({
  cssClassCount: cssClasses.size,
  usedClassCount: usedClasses.size,
  anchorClassCount: anchorClasses.size,
  keptSelectorCount,
  removedImportantCount,
  outputLines,
  outputPath: path.relative(rootDirectory, outputPath).replaceAll("\\", "/")
}, null, 2));
