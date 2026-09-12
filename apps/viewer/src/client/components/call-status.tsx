import type { ToolCall } from "../../model.ts";
import { Badge } from "./ui/badge.tsx";

export function CallStatus({ call }: { call: ToolCall }) {
  const label = call.status === "failed" ? "Failed"
    : call.status === "awaiting" ? "Awaiting result"
      : call.harness === "codex" || call.apiVersion === 1 ? "Result received" : "Completed";
  const variant = call.status === "failed" ? "destructive" : call.status === "awaiting" ? "warning" : "success";
  return (
    <Badge className="status-pill" variant={variant}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
