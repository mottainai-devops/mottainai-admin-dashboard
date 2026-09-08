import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(".github/workflows/deploy.yml");
const workflow = readFileSync(workflowPath, "utf8");
const requiredMarkers = [
  "workflow_dispatch:",
  "release_sha:",
  "Current protected main commit SHA approved for this production release",
  "group: mottainai-admin-dashboard-production",
  "cancel-in-progress: false",
  "name: Verify Manual Release Request",
  "refs/heads/main",
  "git ls-remote",
  "test \"$RELEASE_SHA\" = \"$CURRENT_MAIN_SHA\"",
  "needs: release-preflight",
  "environment:",
  "name: production",
  "ref: ${{ inputs.release_sha }}",
];

const failures = [];

if (/^\s{2}push:\s*$/m.test(workflow)) {
  failures.push("deploy.yml must not deploy from a push trigger");
}

for (const marker of requiredMarkers) {
  if (!workflow.includes(marker)) {
    failures.push(`deploy.yml is missing required release control: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Release-control workflow contract verified.");
