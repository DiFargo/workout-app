import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const productionProjectId = "tren-85720";
const cliArguments = process.argv.slice(2);

function getArgumentValue(name) {
  const equalsArgument = cliArguments.find((argument) => argument.startsWith("--" + name + "="));
  if (equalsArgument) return equalsArgument.slice(name.length + 3);

  const index = cliArguments.indexOf("--" + name);
  return index === -1 ? "" : String(cliArguments[index + 1] || "");
}

const expectedEnvironment = getArgumentValue("environment").trim().toLowerCase();
const requestedProject = getArgumentValue("project").trim();
const activeProject = requestedProject || String(process.env.GCLOUD_PROJECT || "").trim();

if (!activeProject) {
  throw new Error("Firebase deployment requires an explicit --project or GCLOUD_PROJECT.");
}

const artifact = JSON.parse(await readFile(resolve("dist", ".workout-release.json"), "utf8"));
const actualEnvironment = String(artifact.environment || "").trim().toLowerCase();
const impliedEnvironment = activeProject === productionProjectId ? "production" : "staging";

if (!["staging", "production"].includes(actualEnvironment)) {
  throw new Error("dist is missing a valid Firebase release artifact marker. Run the matching build command first.");
}

if (expectedEnvironment && actualEnvironment !== expectedEnvironment) {
  throw new Error("Artifact environment " + actualEnvironment + " does not match expected " + expectedEnvironment + ".");
}

if (actualEnvironment !== impliedEnvironment) {
  throw new Error("Refusing to deploy a " + actualEnvironment + " artifact to " + activeProject + ".");
}

if (String(artifact.firebaseProjectId || "").trim() !== activeProject) {
  throw new Error("Artifact project " + (artifact.firebaseProjectId || "(missing)") + " does not match deploy project " + activeProject + ".");
}

console.log("Verified " + actualEnvironment + " artifact for Firebase project " + activeProject + ".");
