import fs from "node:fs/promises";
import path from "node:path";
import posthtml from "posthtml";
import include from "posthtml-include";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const SRC_PAGES = path.join(SRC, "pages");
const DIST = path.join(ROOT, "dist");

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const e of entries) {
    const from = path.join(src, e.name);
    const to = path.join(dest, e.name);

    if (e.isDirectory()) await copyDir(from, to);
    else await fs.copyFile(from, to);
  }
}

async function copyIfExists(srcDir, destDir) {
  try {
    const stat = await fs.stat(srcDir);
    if (!stat.isDirectory()) return;
    await copyDir(srcDir, destDir);
    console.log(`Copied -> ${destDir}`);
  } catch {
    // dossier absent : on ignore
  }
}

async function build() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  // 1) Copier dossiers statiques
  await copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
  await copyIfExists(path.join(ROOT, "data"), path.join(DIST, "data")); // <-- NEW

  // (optionnel) si tu veux aussi embarquer email-template
 await copyIfExists(path.join(ROOT, "email-template"), path.join(DIST, "email-template"));

  // 2) Générer pages HTML
  const files = await fs.readdir(SRC_PAGES);
  const htmlFiles = files.filter((f) => f.endsWith(".html"));

  for (const file of htmlFiles) {
    const inputPath = path.join(SRC_PAGES, file);
    const html = await fs.readFile(inputPath, "utf8");

    const result = await posthtml([include({ root: SRC })]).process(html, { from: inputPath });

    await fs.writeFile(path.join(DIST, file), result.html, "utf8");
  }

  console.log(`Build OK -> ${DIST}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});