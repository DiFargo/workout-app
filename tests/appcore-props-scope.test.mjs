import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Parser } from "acorn";
import jsx from "acorn-jsx";

const JsxParser = Parser.extend(jsx());

function collectPatternNames(pattern, names) {
  if (!pattern) return;

  switch (pattern.type) {
    case "Identifier":
      names.add(pattern.name);
      break;
    case "ObjectPattern":
      for (const property of pattern.properties || []) {
        if (property.type === "RestElement") {
          collectPatternNames(property.argument, names);
        } else {
          collectPatternNames(property.value || property.argument || property.key, names);
        }
      }
      break;
    case "ArrayPattern":
      for (const element of pattern.elements || []) collectPatternNames(element, names);
      break;
    case "AssignmentPattern":
      collectPatternNames(pattern.left, names);
      break;
    case "RestElement":
      collectPatternNames(pattern.argument, names);
      break;
  }
}

function walk(node, visitor, parent = null) {
  if (!node || typeof node.type !== "string") return;
  visitor(node, parent);

  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, visitor, node);
    } else if (value && typeof value.type === "string") {
      walk(value, visitor, node);
    }
  }
}

function collectTopLevelImports(program) {
  const names = new Set();
  for (const node of program.body) {
    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers || []) {
        if (specifier.local?.name) names.add(specifier.local.name);
      }
    }

    if (node.type === "VariableDeclaration") {
      for (const declaration of node.declarations || []) {
        collectPatternNames(declaration.id, names);
      }
    }

    if (node.type === "FunctionDeclaration" && node.id?.name) {
      names.add(node.id.name);
    }
  }
  return names;
}

function setEarliestDeclarationPosition(map, name, start) {
  const current = map.get(name);
  if (current === undefined || start < current) {
    map.set(name, start);
  }
}

function collectPatternPositions(pattern, positions, start) {
  const names = new Set();
  collectPatternNames(pattern, names);
  for (const name of names) setEarliestDeclarationPosition(positions, name, start);
}

function collectTopLevelDeclarationPositions(program) {
  const positions = new Map();

  for (const node of program.body) {
    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers || []) {
        if (specifier.local?.name) setEarliestDeclarationPosition(positions, specifier.local.name, -1);
      }
    }

    if (node.type === "VariableDeclaration") {
      for (const declaration of node.declarations || []) {
        collectPatternPositions(declaration.id, positions, -1);
      }
    }

    if (node.type === "FunctionDeclaration" && node.id?.name) {
      setEarliestDeclarationPosition(positions, node.id.name, -1);
    }
  }

  return positions;
}

function collectAppScopeNames(appFunction, importedNames) {
  const names = new Set(importedNames);

  walk(appFunction.body, (node, parent) => {
    if (node.type === "VariableDeclarator") {
      collectPatternNames(node.id, names);
    }

    if (node.type === "FunctionDeclaration" && node.id?.name) {
      names.add(node.id.name);
    }

    if (
      (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") &&
      parent?.type === "VariableDeclarator"
    ) {
      collectPatternNames(parent.id, names);
    }
  });

  return names;
}

function collectAppScopeDeclarationPositions(appFunction, topLevelPositions) {
  const positions = new Map(topLevelPositions);

  walk(appFunction.body, (node, parent) => {
    if (node.type === "VariableDeclarator") {
      collectPatternPositions(node.id, positions, node.start);
    }

    if (node.type === "FunctionDeclaration" && node.id?.name) {
      setEarliestDeclarationPosition(positions, node.id.name, -1);
    }

    if (
      (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") &&
      parent?.type === "VariableDeclarator"
    ) {
      collectPatternPositions(parent.id, positions, parent.start);
    }
  });

  return positions;
}

function findAppFunction(program) {
  for (const node of program.body) {
    if (node.type !== "ExportDefaultDeclaration") continue;
    const declaration = node.declaration;
    if (declaration?.type === "FunctionDeclaration" && declaration.id?.name === "App") {
      return declaration;
    }
  }
  return null;
}

function isTargetCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee?.type === "Identifier" &&
    [
      "renderAppRoutePage",
      "renderAppTerminalRoute",
      "renderNutritionPageFromContext"
    ].includes(node.callee.name)
  );
}

function collectDependencyIdentifiers(arrayExpression) {
  const names = new Set();

  walk(arrayExpression, (node, parent) => {
    if (node.type !== "Identifier") return;

    if (
      parent?.type === "MemberExpression" &&
      parent.property === node &&
      !parent.computed
    ) {
      return;
    }

    names.add(node.name);
  });

  return names;
}

test("AppCore route prop shorthand values are declared before runtime render", async () => {
  const source = await fs.readFile("src/AppCore.jsx", "utf8");
  const program = JsxParser.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    locations: true
  });

  const appFunction = findAppFunction(program);
  assert.ok(appFunction, "Expected export default function App() in AppCore.jsx");

  const appScopeNames = collectAppScopeNames(appFunction, collectTopLevelImports(program));
  const missing = [];

  walk(appFunction.body, (node) => {
    if (!isTargetCall(node)) return;

    for (const argument of node.arguments || []) {
      walk(argument, (child) => {
        if (child.type !== "Property" || !child.shorthand || child.key?.type !== "Identifier") {
          return;
        }

        if (!appScopeNames.has(child.key.name)) {
          missing.push(`${child.key.name} at ${child.loc.start.line}:${child.loc.start.column + 1}`);
        }
      });
    }
  });

  assert.deepEqual(missing, []);
});

test("AppCore dependency arrays do not reference values before initialization", async () => {
  const source = await fs.readFile("src/AppCore.jsx", "utf8");
  const program = JsxParser.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    locations: true
  });

  const appFunction = findAppFunction(program);
  assert.ok(appFunction, "Expected export default function App() in AppCore.jsx");

  const declarationPositions = collectAppScopeDeclarationPositions(
    appFunction,
    collectTopLevelDeclarationPositions(program)
  );
  const earlyReferences = [];

  walk(appFunction.body, (node) => {
    if (node.type !== "CallExpression") return;

    for (const argument of node.arguments || []) {
      if (argument.type !== "ArrayExpression") continue;

      for (const name of collectDependencyIdentifiers(argument)) {
        const declarationStart = declarationPositions.get(name);
        if (declarationStart !== undefined && declarationStart > argument.start) {
          earlyReferences.push(`${name} at ${argument.loc.start.line}:${argument.loc.start.column + 1}`);
        }
      }
    }
  });

  assert.deepEqual(earlyReferences, []);
});
