import { Activity, Check, CircleX, Clock3, Timer } from "lucide-react";
import type { HarnessDataset, ToolCall } from "../../model.ts";
import { duration, number } from "../format.ts";
import { Card } from "./ui/card.tsx";

export function Stats({ calls, dataset }: { calls: ToolCall[]; dataset: HarnessDataset | undefined }) {
  const completed = calls.filter((call) => call.status === "completed").length;
  const failed = calls.filter((call) => call.status === "failed").length;
  const explicit = dataset?.harness === "opencode" && dataset.apiVersion === 2;
  const durations = calls.flatMap((call) => call.durationMs === null ? [] : [call.durationMs]).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const median = durations.length % 2 ? durations[middle] ?? null : durations.length ? ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2 : null;
  const cardClass = "stat p-4 lg:p-5";
  const labelClass = "stat-label flex items-center justify-between text-sm text-secondary";
  const valueClass = "my-4 block text-2xl font-semibold tracking-tight text-foreground";
  const captionClass = "stat-caption text-xs leading-5 text-muted";
  return <div className="stats mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
    <Card className={cardClass}><div className={labelClass}>Tool calls <Activity aria-hidden="true" className="size-4 text-muted" /></div><strong className={valueClass} id="stat-calls">{number(calls.length)}</strong><div className={captionClass}>Across the selected view</div></Card>
    <Card className={cardClass}><div className={labelClass}>{explicit ? "Completed" : "Results received"} <Check aria-hidden="true" className="size-4 text-success" /></div><strong className={valueClass} id="stat-completed">{number(completed)}</strong><div className={captionClass}><span className="tiny-dot mr-1.5 inline-block size-1.5 rounded-full bg-success" /> {explicit ? "Successful tool executions" : "Post-tool events received"}</div></Card>
    <Card className={cardClass}><div className={labelClass}>{explicit ? "Failed" : "Awaiting result"} {explicit ? <CircleX aria-hidden="true" className="size-4 text-destructive" /> : <Clock3 aria-hidden="true" className="size-4 text-warning" />}</div><strong className={valueClass} id="stat-awaiting">{number(explicit ? failed : calls.length - completed)}</strong><div className={captionClass}>{explicit ? `${calls.length - completed - failed} awaiting result` : "No matching result in this window"}</div></Card>
    <Card className={cardClass}><div className={labelClass}>Median duration <Timer aria-hidden="true" className="size-4 text-muted" /></div><strong className={valueClass} id="stat-duration">{duration(median)}</strong><div className={captionClass}>Time between paired hook events</div></Card>
  </div>;
}
