import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { LayerTabs } from "./LayerTabs";

afterEach(cleanup);

const noop = () => {};

describe("LayerTabs", () => {
  it("renders one tab per shot", () => {
    render(<LayerTabs count={2} selected={0} onSelect={noop} onAdd={noop} onRemove={noop} />);
    expect(screen.getByRole("tab", { name: /shot 1/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /shot 2/i })).toBeInTheDocument();
  });

  it("hands back the index of the shot you pick", () => {
    const onSelect = vi.fn();
    render(<LayerTabs count={3} selected={0} onSelect={onSelect} onAdd={noop} onRemove={noop} />);
    fireEvent.click(screen.getByRole("tab", { name: /shot 3/i }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("offers a way to add a shot until there are three", () => {
    const onAdd = vi.fn();
    const { rerender } = render(<LayerTabs count={2} selected={0} onSelect={noop} onAdd={onAdd} onRemove={noop} />);
    fireEvent.click(screen.getByRole("button", { name: /add a shot/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    rerender(<LayerTabs count={3} selected={0} onSelect={noop} onAdd={onAdd} onRemove={noop} />);
    expect(screen.queryByRole("button", { name: /add a shot/i })).toBeNull();
  });

  it("removes only the active shot, and never the last one", () => {
    const onRemove = vi.fn();
    const { rerender } = render(<LayerTabs count={1} selected={0} onSelect={noop} onAdd={noop} onRemove={onRemove} />);
    expect(screen.queryByRole("button", { name: /remove shot/i })).toBeNull();
    rerender(<LayerTabs count={2} selected={1} onSelect={noop} onAdd={noop} onRemove={onRemove} />);
    // The remove control only appears on the active tab.
    expect(screen.queryByRole("button", { name: /remove shot 1/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /remove shot 2/i }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
