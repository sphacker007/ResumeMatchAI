import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("contains the complete ResumeMatch AI product workflow", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /ResumeMatch AI/);
  assert.match(page, /Tailor the words/);
  assert.match(page, /Keep the resume/);
  assert.match(page, /Analyze resume/);
  assert.match(page, /Tailor resume/);
  assert.match(page, /Generate final PDF/);
  assert.match(page, /Download PDF/);
  assert.match(page, /Original layout locked/);
  assert.doesNotMatch(page, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships product metadata and the bespoke social card", async () => {
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  await access(new URL("../public/og.png", import.meta.url));
  assert.match(layout, /ResumeMatch AI/);
  assert.match(layout, /\/og\.png/);
  assert.match(page, /\/api\/analyze/);
  assert.match(page, /\/api\/generate/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
