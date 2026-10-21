import test from "node:test";
import assert from "node:assert/strict";
import { initFaqAccordion } from "../src/utils/faq-accordion.mjs";

const fixture = (reduced = false) => {
  const entries = [true, false].map(open => {
    const summary = { setAttribute(name, value) { this[name] = value; }, addEventListener(_, handler) { this.click = () => handler({ preventDefault() {} }); } };
    const panel = { style: {}, scrollHeight: 200, getBoundingClientRect: () => ({ height: 100 }), animate(frames, options) { this.animation = { frames, options, cancel() { this.cancelled = true; } }; return this.animation; } };
    const detail = { open, dataset: {}, querySelector: selector => selector === "summary" ? summary : panel };
    return { summary, panel, detail };
  });
  initFaqAccordion({ querySelectorAll: () => entries.map(e => e.detail) }, { reducedMotion: () => reduced });
  return entries;
};

test("opening a question smoothly closes the previous answer before hiding it", () => {
  const [a, b] = fixture();
  b.summary.click();
  assert.equal(a.detail.open, true);
  assert.equal(a.panel.style.overflow, "hidden");
  assert.equal(a.panel.style.height, "0px");
  assert.equal(a.detail.dataset.expanded, "false");
  assert.equal(b.detail.open, true);
  assert.deepEqual(a.panel.animation.frames, [{ height: "100px" }, { height: "0px" }]);
  assert.deepEqual(b.panel.animation.frames, [{ height: "0px" }, { height: "200px" }]);
  a.panel.animation.onfinish();
  assert.equal(a.detail.open, false);
  assert.equal(a.panel.hidden, true);
  assert.equal(a.panel.style.height, "0px");
  b.panel.animation.onfinish();
  assert.equal(b.panel.hidden, false);
  assert.equal(b.panel.style.height, "auto");
});

test("rapid toggling cancels the old animation and honors the latest intent", () => {
  const [, b] = fixture();
  b.summary.click();
  const old = b.panel.animation;
  b.summary.click();
  assert.equal(old.cancelled, true);
  assert.equal(old.onfinish, null);
  b.panel.animation.onfinish();
  assert.equal(b.detail.open, false);
  assert.equal(b.summary["aria-expanded"], "false");
});

test("reduced-motion users get immediate accessible toggles", () => {
  const [a, b] = fixture(true);
  b.summary.click();
  assert.equal(a.detail.open, false);
  assert.equal(b.detail.open, true);
  assert.equal(b.panel.animation, undefined);
});
