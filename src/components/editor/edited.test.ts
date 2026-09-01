import { describe, expect, it } from "vitest";
import { editedKeys } from "./edited";

const keys = ["a", "b", "c"] as const;

describe("spotting an edit", () => {
  it("finds nothing on an untouched baseline", () => {
    const base = { a: 1, b: 2, c: 3 };
    expect(editedKeys(base, base, keys)).toEqual([]);
  });

  it("names the keys that moved", () => {
    const base = { a: 1, b: 2, c: 3 };
    const moved = { ...base, a: 9, c: 4 };
    expect(editedKeys(moved, base, keys).sort()).toEqual(["a", "c"]);
  });
});
