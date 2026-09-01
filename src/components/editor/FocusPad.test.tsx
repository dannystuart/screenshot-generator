import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FocusPad } from "./FocusPad";

function padAt(width = 200, height = 100) {
  const pad = screen.getByLabelText("Focus point");
  pad.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return pad;
}

describe("FocusPad", () => {
  it("reads the top-left corner as 0,0 and the bottom-right as 1,1", () => {
    const onChange = vi.fn();
    render(<FocusPad x={0.5} y={0.5} onChange={onChange} />);
    const pad = padAt();
    fireEvent.pointerDown(pad, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(0, 0);
    fireEvent.pointerDown(pad, { clientX: 200, clientY: 100, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(1, 1);
  });

  it("centres at 0.5, 0.5", () => {
    const onChange = vi.fn();
    render(<FocusPad x={0} y={0} onChange={onChange} />);
    const pad = padAt();
    fireEvent.pointerDown(pad, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(0.5, 0.5);
  });

  it("nudges toward the top with the up arrow", () => {
    const onChange = vi.fn();
    render(<FocusPad x={0.5} y={0.5} onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText("Focus point"), { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(0.5, 0.48);
  });
});
