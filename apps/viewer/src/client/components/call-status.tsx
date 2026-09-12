import type { ToolCall } from "../../model.ts";
import { Badge } from "./ui/badge.tsx";

export function CallStatus({ status }: { status: ToolCall["status"] }) {
  return (
    <Badge className="status-pill" variant={status === "completed" ? "success" : "warning"}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {status === "completed" ? "Result received" : "Awaiting result"}
    </Badge>
  );
}
