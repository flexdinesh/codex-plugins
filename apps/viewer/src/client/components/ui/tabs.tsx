import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils.ts";

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cn("flex gap-6 border-b border-border", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" role="tab" className={cn("-mb-px border-b-2 border-transparent px-0 py-3 text-sm font-medium text-muted outline-none transition-colors hover:text-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-selected:border-accent aria-selected:text-accent", className)} {...props} />;
}
