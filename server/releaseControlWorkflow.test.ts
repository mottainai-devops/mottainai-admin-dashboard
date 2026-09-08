import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(process.cwd(), ".github/workflows/deploy.yml");

describe("release-control workflow", () => {
  it("requires an explicit current main SHA and never deploys from push", () => {
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("release_sha:");
    expect(workflow).not.toMatch(/^\s{2}push:\s*$/m);
    expect(workflow).toContain('test "$SELECTED_REF" = "refs/heads/main"');
    expect(workflow).toContain('test "$RELEASE_SHA" = "$SELECTED_SHA"');
    expect(workflow).toContain('test "$RELEASE_SHA" = "$CURRENT_MAIN_SHA"');
  });

  it("uses a protected production environment and serialises deployments", () => {
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("group: mottainai-admin-dashboard-production");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("needs: release-preflight");
    expect(workflow).toContain("environment:\n      name: production");
  });
});
