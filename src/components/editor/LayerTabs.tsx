"use client";

export interface LayerTabsProps {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/**
 * The row of shots at the top of the drawer. Selecting one is looking, not
 * editing, so it stays out of the spec; the add and the remove change how many
 * shots the canvas holds. There is always at least one, and never more than
 * three, so those controls come and go with the count.
 */
export function LayerTabs({ count, selected, onSelect, onAdd, onRemove, disabled }: LayerTabsProps) {
  return (
    <div role="tablist" aria-label="Shots" className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: count }, (_, i) => {
        const active = i === selected;
        return (
          <span key={i} className="scr-chip" data-on={active ? "" : undefined} style={{ paddingRight: active && count > 1 ? 4 : undefined }}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => onSelect(i)}
              className="leading-none focus-visible:outline-none"
            >
              Shot {i + 1}
            </button>
            {active && count > 1 ? (
              <button
                type="button"
                aria-label={`Remove shot ${i + 1}`}
                title="Remove this shot"
                disabled={disabled}
                onClick={() => onRemove(i)}
                className="grid h-4 w-4 place-items-center rounded-full text-current/70 transition-colors hover:bg-black/15 hover:text-current"
              >
                <svg viewBox="0 0 16 16" width="9" height="9" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </span>
        );
      })}
      {count < 3 ? (
        <button
          type="button"
          aria-label="Add a shot"
          title="Add a shot"
          disabled={disabled}
          onClick={onAdd}
          className="grid h-[22px] w-[22px] place-items-center rounded-full text-scr-muted transition-colors hover:bg-white/10 hover:text-scr-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
