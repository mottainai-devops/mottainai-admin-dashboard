import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const releaseSha = process.env.RELEASE_SHA ?? "";
const publicDir = process.env.RELEASE_PUBLIC_DIR ?? "dist/public";

if (!/^[a-f0-9]{40}$/i.test(releaseSha)) {
  throw new Error("RELEASE_SHA must be a 40-character Git commit SHA");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(path);
      return [path];
    })
  );
  return files.flat();
}

const assetDir = join(publicDir, "assets");
const assetPaths = (await collectFiles(assetDir)).sort();
if (assetPaths.length === 0) {
  throw new Error("Release build contains no public assets");
}

const assets = await Promise.all(
  assetPaths.map(async path => ({
    path: relative(publicDir, path).replaceAll("\\", "/"),
    sha256: createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
  }))
);

const manifest = {
  releaseSha: releaseSha.toLowerCase(),
  assets,
};

await writeFile(
  join(publicDir, "release-manifest.json"),
  `${JSON.stringify(manifest)}\n`,
  "utf8"
);
