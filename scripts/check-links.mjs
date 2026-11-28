/**
 * Checks every internal link, asset reference, and linked fragment in the built site.
 * Run after `npm run build`: npm run test:links
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const siteOrigin = "https://straightupdigital.local";

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

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function resolveInternalPathname(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relative = decodedPath.replace(/^\/+/, "");
  const root = path.resolve(dist);
  const candidates = relative
    ? [
        path.resolve(root, relative),
        path.resolve(root, `${relative}.html`),
        path.resolve(root, relative, "index.html"),
      ]
    : [path.resolve(root, "index.html")];

  for (const candidate of candidates) {
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) continue;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function extractIds(markup) {
  const ids = new Set();
  const duplicates = new Set();
  const pattern = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/g;
  for (const match of markup.matchAll(pattern)) {
    const id = decodeEntities(match[1] ?? match[2]);
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }
  return { ids, duplicates };
}

const broken = [];
const checked = new Set();
const idsByFile = new Map();

async function idsForFile(file) {
  if (!idsByFile.has(file)) {
    const markup = await readFile(file, "utf8");
    idsByFile.set(file, extractIds(markup).ids);
  }
  return idsByFile.get(file);
}

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const page = `/${path.relative(dist, file).replace(/\\/g, "/")}`;

  const { ids, duplicates } = extractIds(html);
  for (const id of duplicates) broken.push(`${page} -> duplicate id="${id}"`);

  for (const match of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
    const [, attribute, rawUrl] = match;
    const url = decodeEntities(rawUrl);
    let parsed;
    try {
      parsed = new URL(url, `${siteOrigin}${page}`);
    } catch {
      broken.push(`${page} -> invalid URL: ${rawUrl}`);
      continue;
    }
    if (parsed.origin !== siteOrigin) continue;

    const key = `${page} -> ${rawUrl}`;
    if (checked.has(key)) continue;
    checked.add(key);

    const destination = resolveInternalPathname(parsed.pathname);
    if (!destination) {
      broken.push(key);
      continue;
    }

    if (attribute !== "href" || !parsed.hash) continue;
    let fragment;
    try {
      fragment = decodeEntities(decodeURIComponent(parsed.hash.slice(1)));
    } catch {
      broken.push(`${page} -> malformed fragment in ${rawUrl}`);
      continue;
    }
    if (!fragment) continue;

    const targetIds = destination === file ? ids : await idsForFile(destination);
    if (!targetIds.has(fragment)) {
      const targetPage = `/${path.relative(dist, destination).replace(/\\/g, "/")}`;
      broken.push(`${page} -> ${rawUrl} (missing #${fragment} on ${targetPage})`);
    }
  }
}

console.log(`Checked ${checked.size} internal references and linked fragments across ${htmlFiles.length} pages.`);
if (broken.length) {
  console.log(`\nBroken references (${broken.length}):`);
  broken.forEach((entry) => console.log(`  ${entry}`));
  process.exit(1);
}
console.log("No broken internal links or assets.");
