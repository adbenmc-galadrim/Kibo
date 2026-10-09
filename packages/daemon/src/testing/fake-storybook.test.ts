import { afterEach, beforeEach, expect, test } from "bun:test";
import { type FakeStorybook, startFakeStorybook } from "./fake-storybook";

let sb: FakeStorybook;
beforeEach(() => {
  sb = startFakeStorybook();
  sb.addStory("screens-home--default", "Screens/Home", "Default");
});
afterEach(() => sb.stop());

test("iframe.html renders the story with a click counter", async () => {
  const res = await fetch(`${sb.url}/iframe.html?id=screens-home--default&viewMode=story`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  const html = await res.text();
  expect(html).toContain('data-story="screens-home--default"');
  expect(html).toContain("Cliquer");
  expect(html).toContain("Clics : 0");
});

test("an unsafe story id is never echoed into the page", async () => {
  const html = await (await fetch(`${sb.url}/iframe.html?id=%22%3E%3Cscript%3E`)).text();
  expect(html).not.toContain("<script>alert");
  expect(html).not.toContain('"><script>');
});

test("index.json lists the added stories", async () => {
  const res = await fetch(`${sb.url}/index.json`);
  expect(await res.json()).toEqual({
    v: 5,
    entries: {
      "screens-home--default": {
        id: "screens-home--default",
        title: "Screens/Home",
        name: "Default",
        type: "story",
      },
    },
  });
});

test("noIndex answers 404 on index.json like Storybook 6", async () => {
  sb.noIndex = true;
  expect((await fetch(`${sb.url}/index.json`)).status).toBe(404);
  expect((await fetch(`${sb.url}/iframe.html`)).status).toBe(200);
});

test("indexOverride replaces the body of index.json", async () => {
  sb.indexOverride = "{not json";
  expect(await (await fetch(`${sb.url}/index.json`)).text()).toBe("{not json");
});

test("offline answers 503 everywhere until online again", async () => {
  expect((await fetch(`${sb.url}/__test/offline`, { method: "POST" })).status).toBe(204);
  expect(sb.offline).toBe(true);
  expect((await fetch(`${sb.url}/iframe.html`)).status).toBe(503);
  expect((await fetch(`${sb.url}/index.json`)).status).toBe(503);
  await fetch(`${sb.url}/__test/online`, { method: "POST" });
  expect((await fetch(`${sb.url}/iframe.html`)).status).toBe(200);
});

test("requests are journaled with their path and query", async () => {
  await fetch(`${sb.url}/iframe.html?id=a--b`);
  await fetch(`${sb.url}/index.json`);
  expect(sb.requests).toEqual([
    { method: "GET", path: "/iframe.html", query: "?id=a--b" },
    { method: "GET", path: "/index.json", query: "" },
  ]);
});
