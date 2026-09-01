import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getImage, imageActions, pruneImages, putImage } from "./images";

describe("imageActions", () => {
  it("loads a shot's new picture", () => {
    expect(imageActions(new Map(), [{ id: "a", imageKey: "k1" }])).toEqual([{ id: "a", kind: "load", key: "k1" }]);
  });

  it("does nothing when the picture is already loaded", () => {
    expect(imageActions(new Map([["a", "k1"]]), [{ id: "a", imageKey: "k1" }])).toEqual([]);
  });

  it("clears a shot whose key was reverted to empty — the undo/reset case", () => {
    expect(imageActions(new Map([["a", "k1"]]), [{ id: "a", imageKey: "" }])).toEqual([{ id: "a", kind: "clear" }]);
  });

  it("clears the texture of a shot that has left the scene", () => {
    expect(
      imageActions(new Map([["a", "k1"], ["b", "k2"]]), [{ id: "a", imageKey: "k1" }]),
    ).toEqual([{ id: "b", kind: "clear" }]);
  });
});

const blob = (s: string) => new Blob([s], { type: "text/plain" });

describe("the image store", () => {
  it("gives back what was put under a key", async () => {
    await putImage("a", blob("hello"));
    expect(await getImage("a")).toBeTruthy();
  });

  it("returns null for a key it never saw", async () => {
    expect(await getImage("stranger")).toBeNull();
  });

  it("drops everything not in the keep set", async () => {
    await putImage("keep1", blob("1"));
    await putImage("keep2", blob("2"));
    await putImage("orphan", blob("3"));
    await pruneImages(new Set(["keep1", "keep2"]));
    expect(await getImage("keep1")).not.toBeNull();
    expect(await getImage("keep2")).not.toBeNull();
    expect(await getImage("orphan")).toBeNull();
  });
});
