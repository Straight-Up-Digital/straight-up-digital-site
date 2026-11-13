/**
 * Checks every internal link and asset reference in the built site.
 * Run after `npm run build`: npm run test:links
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");

if (!existsSync(dist)) {
  console.error("dist/ not found. Run `npm run build` first.");
  process.exit(1);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const files = await walk(dist);
const htmlFiles = files.filter((file) => file.endsWith(".html"));

const resolveInternal = (url) => {
  const clean = url.split("#")[0].split("?")[0];
  if (clean === "" || clean === "/") return path.join(dist, "index.html");

  const relative = clean.replace(/^\//, "");
  const direct = path.join(dist, relative);
  const candidates = [
    direct,
    path.join(dist, `${relative}.html`),
    path.join(direct, "index.html"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        if (stat(candidate) && candidate) return candidate;
      } catch {
        // keep looking
      }
    }
  }
  return null;
};

const broken = [];
const checked = new Set();

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const page = `/${path.relative(dist, file).replace(/\\/g, "/")}`;

  const matches = html.matchAll(/(?:href|src)="([^"]+)"/g);
  for (const match of matches) {
    const url = match[1];
    if (!url.startsWith("/")) continue;
    if (url.startsWith("//")) continue;

    const key = `${page} -> ${url}`;
    if (checked.has(key)) continue;
    checked.add(key);

    if (!resolveInternal(url)) {
      broken.push(key);
    }
  }
}

console.log(`Checked ${checked.size} internal references across ${htmlFiles.length} pages.`);
if (broken.length) {
  console.log(`\nBroken references (${broken.length}):`);
  broken.forEach((entry) => console.log(`  ${entry}`));
  process.exit(1);
}
console.log("No broken internal links or assets.");
