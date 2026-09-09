import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useDialogFocus({ onClose, returnFocusRef, searchRef }: {
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = returnFocusRef.current;
    document.body.classList.add("inspector-open");
    closeRef.current?.focus();
    return () => {
      document.body.classList.remove("inspector-open");
      if (trigger?.isConnected) trigger.focus();
      else searchRef.current?.focus();
    };
  }, [returnFocusRef, searchRef]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('button,summary,[tabindex="0"]') ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [onClose]);

  return { dialogRef, closeRef };
}
