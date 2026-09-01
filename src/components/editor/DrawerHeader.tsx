"use client";

export interface DrawerHeaderProps {
  /** The tool's name, drawn small and tracked in the corner. */
  title?: string;
  /** Some dial sits off where its preset put it. */
  edited: boolean;
  /** Anything at all differs from how the page opens. */
  changed: boolean;
  /** A Reset all just replaced the design; one step back is on offer. */
  canUndo: boolean;
  onUndo: () => void;
  onUndoEdits: () => void;
  onReset: () => void;
  onClose: () => void;
}

const Reset = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" fill="none" aria-hidden>
    <path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.48" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M2.4 2.6v3h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The part of the drawer that never scrolls: what this is, and the two ways
 * back from an edit.
 */
export function DrawerHeader({
  title = "Screenshot",
  edited,
  changed,
  canUndo,
  onUndo,
  onUndoEdits,
  onReset,
  onClose,
}: DrawerHeaderProps) {
  return (
    <div className="relative z-[2] shrink-0 border-b border-scr-line bg-scr-panel px-4 pb-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[11px] uppercase leading-none tracking-[0.16em] text-scr-faint">{title}</h1>
        <button
          type="button"
          onClick={onClose}
          aria-expanded
          aria-label="Close the tools"
          title="Close the tools"
          className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-scr-muted transition-[background-color,color,transform] duration-150 hover:bg-white/[0.07] hover:text-text active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60 motion-reduce:transition-none"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden>
            <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {edited || changed || canUndo ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* Two ways back, for two distances. Undo edits walks the dials back
                to how the shot opened; Reset all puts the whole page back to how
                it opened — background, view, frame, the lot. */}
            {edited ? (
              <button type="button" onClick={onUndoEdits} className="scr-chip scr-reset" title="Put every dial back where it opened">
                <Reset />
                Undo edits
              </button>
            ) : null}
            {changed ? (
              <button type="button" onClick={onReset} className="scr-chip" title="Back to the background, view and frame the page opens with">
                Reset all
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            {canUndo ? (
              <button type="button" onClick={onUndo} className="scr-chip" title="Bring back the design this replaced">
                ↶ Undo
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
