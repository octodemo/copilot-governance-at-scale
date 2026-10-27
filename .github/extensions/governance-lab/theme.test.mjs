import assert from "node:assert/strict";
import test from "node:test";
import { PRIMER_THEMES, syncTheme, watchTheme } from "./ui/theme.js";

function element(initial = {}) {
  const attributes = { ...initial };
  return {
    attributes,
    getAttribute: (name) => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = value; }
  };
}

test("theme follows host tone before mode and falls back to system auto", () => {
  for (const [attributes, expected] of [
    [{}, "auto"],
    [{ "data-color-mode": "dark" }, "dark"],
    [{ "data-color-mode": "light" }, "light"],
    [{ "data-color-mode": "custom" }, "auto"],
    [{ "data-theme-tone": "dark", "data-color-mode": "light" }, "dark"],
    [{ "data-theme-tone": "light", "data-color-mode": "dark" }, "light"]
  ]) {
    const body = element();
    syncTheme(element(attributes), body);
    assert.equal(body.attributes["data-color-mode"], expected);
    assert.equal(body.attributes["data-light-theme"], "light");
    assert.equal(body.attributes["data-dark-theme"], "dark");
  }
});

test("recognized accessibility themes survive while host-specific names fall back", () => {
  for (const name of PRIMER_THEMES) {
    const attribute = name.startsWith("light") ? "data-light-theme" : "data-dark-theme";
    const body = element();
    syncTheme(element({ [attribute]: name }), body);
    assert.equal(body.attributes[attribute], name);
  }
  const body = element();
  syncTheme(element({ "data-light-theme": "host-light", "data-dark-theme": "host-dark" }), body);
  assert.equal(body.attributes["data-light-theme"], "light");
  assert.equal(body.attributes["data-dark-theme"], "dark");
});

test("theme watcher initializes immediately and follows host attribute changes", (t) => {
  const previous = globalThis.MutationObserver;
  let callback;
  let observation;
  globalThis.MutationObserver = class {
    constructor(update) { callback = update; }
    observe(root, options) { observation = { root, options }; }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previous;
  });
  const document = { documentElement: element({ "data-theme-tone": "light" }), body: element() };
  watchTheme(document);
  assert.equal(document.body.attributes["data-color-mode"], "light");
  assert.equal(observation.root, document.documentElement);
  assert.deepEqual(observation.options, {
    attributes: true,
    attributeFilter: ["data-color-mode", "data-light-theme", "data-dark-theme", "data-theme-tone"]
  });
  document.documentElement.setAttribute("data-theme-tone", "dark");
  callback();
  assert.equal(document.body.attributes["data-color-mode"], "dark");
});
