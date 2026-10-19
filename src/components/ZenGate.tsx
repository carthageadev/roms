"use client";

/**
 * The whole navigation: one dim point in the corner that breathes. Touching it
 * opens a quiet gate - the page blurs away behind two enormous words, nothing
 * else. No bar, no logo, no list of links sitting there being furniture.
 */
import { useEffect, useRef, useState } from "react";

type View = "home" | "lists";

const ENTRIES: { id: View; label: string; note: string }[] = [
  { id: "home", label: "Home", note: "the lineup" },
  { id: "lists", label: "Lists", note: "your quiet shelves" },
];

export function ZenGate({ view, listCount, onNavigate }: { view: View; listCount: number; onNavigate: (view: View) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The page behind the gate is not reachable while it is open.
    const behind = document.querySelector<HTMLElement>(".app-shell .main-content");
    behind?.setAttribute("inert", "");
    current.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      behind?.removeAttribute("inert");
    };
  }, [open]);

  function choose(id: View) {
    onNavigate(id);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="zen-trigger"
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        onClick={() => setOpen(true)}
      >
        <span className="zen-trigger-dot" aria-hidden="true" />
      </button>

      <div
        className={`zen-gate${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        onClick={() => setOpen(false)}
      >
        <nav className="zen-gate-list" onClick={(event) => event.stopPropagation()}>
          {ENTRIES.map((entry) => (
            <button
              key={entry.id}
              ref={entry.id === view ? current : undefined}
              type="button"
              className={`zen-entry${entry.id === view ? " is-current" : ""}`}
              aria-current={entry.id === view ? "page" : undefined}
              onClick={() => choose(entry.id)}
            >
              <span className="zen-entry-word">{entry.label}</span>
              <span className="zen-entry-note">
                {entry.note}
                {entry.id === "lists" && listCount > 0 ? <b>{listCount}</b> : null}
              </span>
            </button>
          ))}
        </nav>
        <p className="zen-gate-hint">esc</p>
      </div>
    </>
  );
}
