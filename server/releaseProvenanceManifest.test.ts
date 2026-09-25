import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/write-release-manifest.mjs");
const createdDirectories: string[] = [];

function makeBuild() {
  const root = mkdtempSync(join(tmpdir(), "release-manifest-"));
  createdDirectories.push(root);
  const publicDir = join(root, "dist", "public");
  const assetDir = join(publicDir, "assets");
  mkdirSync(assetDir, { recursive: true });
  writeFileSync(join(assetDir, "index-example.js"), "release asset", "utf8");
  return publicDir;
}

afterEach(() => {
  for (const directory of createdDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("release provenance manifest", () => {
  it("records only the release SHA and public asset hashes", () => {
    const publicDir = makeBuild();
    const result = spawnSync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        RELEASE_SHA: "a".repeat(40),
        RELEASE_PUBLIC_DIR: publicDir,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const manifest = JSON.parse(
      readFileSync(join(publicDir, "release-manifest.json"), "utf8")
    );
    expect(manifest).toEqual({
      releaseSha: "a".repeat(40),
      assets: [
        {
          path: "assets/index-example.js",
          sha256: createHash("sha256").update("release asset").digest("hex"),
        },
      ],
    });
  });

  it("rejects a missing or malformed release revision", () => {
    const publicDir = makeBuild();
    const result = spawnSync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        RELEASE_SHA: "invalid",
        RELEASE_PUBLIC_DIR: publicDir,
      },
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("40-character Git commit SHA");
  });
});
