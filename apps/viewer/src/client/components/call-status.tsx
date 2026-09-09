import type { ToolCall } from "../../model.ts";

export function CallStatus({ status }: { status: ToolCall["status"] }) {
  return (
    <span className={`status-pill ${status}`}>
      {status === "completed" ? "Result received" : "Awaiting result"}
    </span>
  );
}
