import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("https://resumematch.example/", { headers: { accept: "text/html", host: "resumematch.example" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the ResumeMatch AI product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /ResumeMatch AI/);
  assert.match(html, /Tailor the words/);
  assert.match(html, /Keep the resume/);
  assert.match(html, /Analyze resume/);
  assert.match(html, /Original layout locked/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
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
