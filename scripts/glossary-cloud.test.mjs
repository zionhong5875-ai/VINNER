import test from "node:test";
import assert from "node:assert/strict";
import { cloudPosition } from "../src/utils/glossary-cloud.mjs";

test("growing categories never place two terms in the same position", () => {
  for (const category of ["qualifications", "testing", "regulations", "fundamentals"]) {
    for (let total = 1; total <= 60; total++) {
      const positions = Array.from({ length: total }, (_, i) => cloudPosition(i, total, category));
      assert.equal(new Set(positions.map(p => `${p.x},${p.y}`)).size, total);
      for (const p of positions) {
        assert.ok(parseFloat(p.x) > 0 && parseFloat(p.x) < 100);
        assert.ok(parseFloat(p.y) > 0 && parseFloat(p.y) < 100);
      }
    }
  }
});

test("existing eleven-term layouts keep their established positions", () => {
  assert.deepEqual(cloudPosition(10, 11, "testing"), { x: "69.00%", y: "89.00%" });
  assert.deepEqual(cloudPosition(0, 11, "fundamentals"), { x: "18.00%", y: "17.00%" });
});
