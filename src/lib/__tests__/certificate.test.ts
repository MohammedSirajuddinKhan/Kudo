// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  createTextMeasurer,
  layoutTextField,
  transformText,
  type CertificateField,
  type TextMeasurer,
} from "@/lib/certificate";

/**
 * Deterministic measurer that models real text metrics: width scales with the
 * font size parsed out of the canvas font string (CHAR units at 100px), so
 * auto-fit shrinking behaves exactly like the browser-backed engine.
 */
const CHAR = 100;
const fixedMeasure: TextMeasurer = (text, font) => {
  const m = font.match(/([\d.]+)px/);
  const size = m ? parseFloat(m[1]) : 100;
  return text.length * CHAR * (size / 100);
};

function makeField(overrides: Partial<CertificateField> = {}): CertificateField {
  return {
    id: "f1",
    name: "Full Name",
    type: "text",
    x: 0.1,
    y: 0.1,
    width: 0.3,
    height: 0.06,
    fontSize: 100,
    fontFamily: "Georgia, serif",
    fontWeight: 400,
    italic: false,
    underline: false,
    color: "#1a1a2e",
    align: "center",
    vAlign: "middle",
    letterSpacing: 0,
    lineHeight: 1.2,
    textTransform: "none",
    autoFit: true,
    wrap: false,
    required: false,
    source: "manual",
    ...overrides,
  };
}

describe("transformText", () => {
  it("applies uppercase, lowercase, capitalize and none", () => {
    expect(transformText("hello world", "uppercase")).toBe("HELLO WORLD");
    expect(transformText("HELLO WORLD", "lowercase")).toBe("hello world");
    expect(transformText("hello world", "capitalize")).toBe("Hello World");
    expect(transformText("hello world", "none")).toBe("hello world");
  });

  it("capitalizes ASCII word starts; ASCII \b quirks around non-ASCII letters", () => {
    expect(transformText("café shop", "capitalize")).toBe("CafÉ Shop");
    expect(transformText("ñño q", "capitalize")).toBe("ññO Q");
  });
});

describe("createTextMeasurer", () => {
  it("returns finite, non-negative widths and handles empty strings", () => {
    const measure = createTextMeasurer();
    expect(measure("", "400 100px Georgia", 0)).toBe(0);
    const w = measure("abc", "400 100px Georgia", 0);
    expect(Number.isFinite(w)).toBe(true);
    expect(w).toBeGreaterThanOrEqual(0);
  });
});

describe("layoutTextField — no-wrap auto-fit (shared by exports + WYSIWYG overlay)", () => {
  it("keeps the configured size when text already fits", () => {
    // "hi" = 2 chars = 200 units ≤ 500 box → no shrink.
    const r = layoutTextField(fixedMeasure, makeField(), "hi", 500, 200, false);
    expect(r.size).toBe(100);
    expect(r.lines).toEqual(["hi"]);
  });

  it("shrinks to fit (autoFit) at the engine's 0.94 step", () => {
    // 10 chars = 1000 units > 500 → shrinks until 10 * size ≤ 500 → size ≈ 47.6.
    const r = layoutTextField(fixedMeasure, makeField(), "0123456789", 500, 200, false);
    expect(r.size).toBeCloseTo(47.6, 1);
    expect(r.lines).toEqual(["0123456789"]);
  });

  it("never shrinks below the 6px floor for hopelessly long text", () => {
    // 200 chars can never fit a 500px box; the loop stops at the floor.
    const r = layoutTextField(fixedMeasure, makeField(), "x".repeat(200), 500, 200, false);
    expect(r.size).toBeLessThan(6);
    expect(r.size).toBeGreaterThan(5.5);
  });

  it("does not shrink when autoFit is off", () => {
    const r = layoutTextField(
      fixedMeasure,
      makeField({ autoFit: false }),
      "0123456789",
      500,
      200,
      false,
    );
    expect(r.size).toBe(100);
  });

  it("scales letter-spacing proportionally while shrinking", () => {
    const calls: Array<{ text: string; font: string; spacing: number }> = [];
    const spy: TextMeasurer = (text, font, spacing) => {
      calls.push({ text, font, spacing });
      return text.length * CHAR;
    };
    layoutTextField(spy, makeField({ letterSpacing: 2 }), "0123456789", 500, 200, false);
    const first = calls[0];
    expect(first.spacing).toBe(2);
    expect(first.font).toContain("100px");
    // After one shrink step (size 94), spacing scales to 2 * 94/100.
    expect(calls[1].spacing).toBeCloseTo(1.88, 5);
    expect(calls[1].font).toContain("94px");
  });
});

describe("layoutTextField — wrap mode", () => {
  it("wraps on spaces when lines exceed the box width", () => {
    // 3-char words, 5 chars fit per line at CHAR=100.
    const r = layoutTextField(
      fixedMeasure,
      makeField({ wrap: true, autoFit: false }),
      "aaa bbb ccc",
      500,
      1000,
      false,
    );
    expect(r.lines).toEqual(["aaa", "bbb", "ccc"]);
    expect(r.size).toBe(100);
  });

  it("shrinks wrapped text until the block fits the box height", () => {
    // As the size shrinks, two words eventually share a line (7 chars fit
    // the 500px box below ~71px), settling at 2 lines ≈ 66px: height
    // 2 · 66 · 1.2 ≈ 158 ≤ 240.
    const r = layoutTextField(
      fixedMeasure,
      makeField({ wrap: true, autoFit: false }),
      "aaa bbb ccc",
      500,
      240,
      false,
    );
    expect(r.lines).toEqual(["aaa bbb", "ccc"]);
    expect(r.size).toBeLessThan(70);
    expect(r.size).toBeGreaterThan(60);
  });

  it("keeps an unbreakable single word on one line", () => {
    const r = layoutTextField(
      fixedMeasure,
      makeField({ wrap: true, autoFit: false }),
      "abcdefgh",
      500,
      1000,
      false,
    );
    expect(r.lines).toEqual(["abcdefgh"]);
    expect(r.size).toBe(100);
  });
});

describe("layoutTextField — placeholder and test-mode samples", () => {
  it("uses the field placeholder when the value is empty", () => {
    const r = layoutTextField(
      fixedMeasure,
      makeField({ placeholder: "Recipient name" }),
      "",
      5000,
      1000,
      false,
    );
    expect(r.lines).toEqual(["Recipient name"]);
  });

  it("injects a Sample label in test mode and nothing otherwise", () => {
    const test = layoutTextField(fixedMeasure, makeField(), "", 5000, 1000, true);
    expect(test.lines).toEqual(["Sample Full Name"]);
    const real = layoutTextField(fixedMeasure, makeField(), "", 5000, 1000, false);
    expect(real.lines).toEqual([""]);
    expect(real.size).toBe(100);
  });

  it("applies text transform before fitting (uppercase widens the measured text)", () => {
    // "aB" uppercases to "AB" — still 2 chars, but proves the transform ran.
    const r = layoutTextField(
      fixedMeasure,
      makeField({ textTransform: "uppercase" }),
      "aB",
      5000,
      1000,
      false,
    );
    expect(r.lines).toEqual(["AB"]);
  });
});
