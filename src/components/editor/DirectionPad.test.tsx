import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { DirectionPad } from "./DirectionPad";

afterEach(cleanup);

describe("DirectionPad", () => {
  it("hands back the angle of the direction you click", () => {
    const onChange = vi.fn();
    render(<DirectionPad label="Fade direction" value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /^down$/i }));
    expect(onChange).toHaveBeenCalledWith(90);
    fireEvent.click(screen.getByRole("radio", { name: /^right$/i }));
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("is a labelled radiogroup with the live direction checked", () => {
    render(<DirectionPad label="Fade direction" value={90} onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Fade direction" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^down$/i })).toBeChecked();
  });

  it("steps around the ring with the arrow keys", () => {
    const onChange = vi.fn();
    render(<DirectionPad label="Fade direction" value={0} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(45);
  });
});
