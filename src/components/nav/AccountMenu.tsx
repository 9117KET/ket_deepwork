/**
 * components/nav/AccountMenu.tsx
 *
 * Small, dependency-free account dropdown used in the app header.
 * Keeps secondary actions (help, dashboards, share, sign out) out of the main UI
 * so the header stays clean on both desktop and mobile.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

type MenuItem =
  | {
      kind: "action";
      key: string;
      label: string;
      onSelect: () => void;
      muted?: boolean;
      hidden?: boolean;
    }
  | { kind: "separator"; key: string; hidden?: boolean };

interface AccountMenuProps {
  userInitial: string;
  userEmail?: string | null;
  items: MenuItem[];
}

export function AccountMenu({
  userInitial,
  userEmail,
  items,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (onSelect: () => void) => {
    setOpen(false);
    onSelect();
  };

  const firstActionKey = useMemo(() => {
    const first = visibleItems.find((i) => i.kind === "action");
    return first?.kind === "action" ? first.key : undefined;
  }, [visibleItems]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 hover:border-share-primary/50"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-slate-950">
          {userInitial}
        </div>
        <div className="hidden min-w-0 text-left text-xs text-share-onSurface sm:block">
          <div className="max-w-[180px] truncate font-medium">
            {userEmail ?? "Account"}
          </div>
          <div className="text-[11px] text-share-onSurfaceVariant">Menu</div>
        </div>
        <span className="sr-only">Open account menu</span>
        <span className="px-1 text-share-onSurfaceVariant" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer shadow-xl"
        >
          <div className="px-3 py-2 sm:hidden">
            <div className="text-xs font-medium text-share-onSurface">Account</div>
            {userEmail ? (
              <div className="mt-0.5 truncate text-xs text-share-onSurfaceVariant">
                {userEmail}
              </div>
            ) : null}
          </div>
          {visibleItems.map((item) => {
            if (item.kind === "separator") {
              return (
                <div
                  key={item.key}
                  role="separator"
                  className="my-1 h-px bg-slate-800"
                />
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(item.onSelect)}
                autoFocus={item.key === firstActionKey}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-share-surfaceContainerHigh ${
                  item.muted ? "text-share-onSurfaceVariant" : "text-share-onSurface"
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
