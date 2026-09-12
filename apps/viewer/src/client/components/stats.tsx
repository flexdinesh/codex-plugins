import { Activity, Check, Clock3, Timer } from "lucide-react";
import type { ToolCall } from "../../model.ts";
import { duration, number } from "../format.ts";
import { Card } from "./ui/card.tsx";

export function Stats({ calls }: { calls: ToolCall[] }) {
  const completed = calls.filter((call) => call.status === "completed").length;
  const durations = calls.flatMap((call) => call.durationMs === null ? [] : [call.durationMs]).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const median = durations.length % 2 ? durations[middle] ?? null : durations.length ? ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2 : null;
  const cardClass = "stat p-4 lg:p-5";
  const labelClass = "stat-label flex items-center justify-between text-sm text-secondary";
  const valueClass = "my-4 block text-2xl font-semibold tracking-tight text-foreground";
  const captionClass = "stat-caption text-xs leading-5 text-muted";
  return <div className="stats mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
    <Card className={cardClass}><div className={labelClass}>Tool calls <Activity aria-hidden="true" className="size-4 text-muted" /></div><strong className={valueClass} id="stat-calls">{number(calls.length)}</strong><div className={captionClass}>Across the selected view</div></Card>
    <Card className={cardClass}><div className={labelClass}>Results received <Check aria-hidden="true" className="size-4 text-success" /></div><strong className={valueClass} id="stat-completed">{number(completed)}</strong><div className={captionClass}><span className="tiny-dot mr-1.5 inline-block size-1.5 rounded-full bg-success" /> Post-tool events received</div></Card>
    <Card className={cardClass}><div className={labelClass}>Awaiting result <Clock3 aria-hidden="true" className="size-4 text-warning" /></div><strong className={valueClass} id="stat-awaiting">{number(calls.length - completed)}</strong><div className={captionClass}>No matching result in this window</div></Card>
    <Card className={cardClass}><div className={labelClass}>Median duration <Timer aria-hidden="true" className="size-4 text-muted" /></div><strong className={valueClass} id="stat-duration">{duration(median)}</strong><div className={captionClass}>Time between paired hook events</div></Card>
  </div>;
}
