import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils.ts";

export function SheetOverlay({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overlay fixed inset-0 z-40 bg-overlay backdrop-blur-xs", className)} {...props} />;
}

export function SheetContent({ className, ref, ...props }: HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }) {
  return <aside ref={ref} role="dialog" aria-modal="true" tabIndex={-1} className={cn("inspector fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-surface p-6 shadow-overlay outline-none sm:max-w-[520px]", className)} {...props} />;
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-4", className)} {...props} />;
}
