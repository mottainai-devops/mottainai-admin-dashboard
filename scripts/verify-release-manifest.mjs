import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const [manifestPath, expectedReleaseSha] = process.argv.slice(2);

if (!manifestPath || !expectedReleaseSha) {
  throw new Error(
    "Usage: verify-release-manifest.mjs <manifest-path> <release-sha>"
  );
}

if (!/^[a-f0-9]{40}$/i.test(expectedReleaseSha)) {
  throw new Error("Expected release SHA must be a 40-character Git commit SHA");
}

const publicDir = dirname(resolve(manifestPath));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.releaseSha !== expectedReleaseSha.toLowerCase()) {
  throw new Error(
    "Deployed manifest release revision does not match the approved release"
  );
}

if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  throw new Error("Deployed manifest contains no static assets");
}

for (const asset of manifest.assets) {
  if (
    !asset ||
    typeof asset.path !== "string" ||
    typeof asset.sha256 !== "string"
  ) {
    throw new Error("Deployed manifest contains an invalid asset entry");
  }

  const assetPath = resolve(publicDir, asset.path);
  if (
    !assetPath.startsWith(`${publicDir}${sep}`) ||
    !asset.path.startsWith("assets/")
  ) {
    throw new Error("Deployed manifest asset path is unsafe");
  }

  const actualHash = createHash("sha256")
    .update(await readFile(assetPath))
    .digest("hex");
  if (actualHash !== asset.sha256) {
    throw new Error(
      "Deployed static asset hash does not match the release manifest"
    );
  }
}

console.log("Deployed static asset provenance verified.");
