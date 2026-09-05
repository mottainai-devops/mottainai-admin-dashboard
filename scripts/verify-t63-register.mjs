import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = relativePath =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
const core = loadJson("ci/core-surface.json");
const register = loadJson(core.t63Register);
const tsconfig = loadJson("tsconfig.core.json");

const assert = (condition, message) => {
  if (!condition) throw new Error(`T63 register verification failed: ${message}`);
};
const unique = values => new Set(values).size === values.length;

const ids = register.items.map(item => item.id);
const paths = register.items.map(item => item.path);
assert(register.items.length === 14, "the visible T63 register must contain all 14 recorded functional defects");
assert(unique(ids), "T63 identifiers must be unique");
assert(unique(paths), "each functional-debt source path must be listed once");
assert(
  register.items.every(
    item => item.priority >= 1 && item.priority <= 14 && item.securityReview.startsWith("functional-only")
  ),
  "every T63 item must have a functional-only security review and a bounded priority"
);
assert(
  register.items.map(item => item.priority).sort((a, b) => a - b).every((value, index) => value === index + 1),
  "T63 priorities must be a complete 1–14 ranking"
);
assert(
  JSON.stringify(core.typecheckFiles) === JSON.stringify(tsconfig.files),
  "tsconfig.core.json must exactly match the visible core-surface typecheck file list"
);
assert(
  core.legacyQuarantine.includes("server/simpleAuthRouter.ts"),
  "the legacy simple-auth router quarantine must remain explicit"
);
assert(
  fs.readFileSync(path.join(projectRoot, "tsconfig.json"), "utf8").includes("server/simpleAuthRouter.ts"),
  "the root configuration must visibly retain the legacy simple-auth quarantine"
);

for (const relativePath of [...core.typecheckFiles, ...core.legacyQuarantine, ...paths]) {
  assert(fs.existsSync(path.join(projectRoot, relativePath)), `${relativePath} must exist`);
}

console.log(`T63 register verified: ${register.items.length} functional-only items; ${core.typecheckFiles.length} core typecheck files.`);
