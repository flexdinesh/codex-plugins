import type { ToolCall } from "../../model.ts";
import { duration, number } from "../format.ts";

export function Stats({ calls }: { calls: ToolCall[] }) {
  const completed = calls.filter((call) => call.status === "completed").length;
  const durations = calls.flatMap((call) => call.durationMs === null ? [] : [call.durationMs]).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const median = durations.length % 2 ? durations[middle] ?? null : durations.length ? ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2 : null;
  return <div className="stats">
    <article className="stat"><div className="stat-label">Tool calls <span>↗</span></div><strong id="stat-calls">{number(calls.length)}</strong><div className="stat-caption">Across the selected view</div></article>
    <article className="stat"><div className="stat-label">Results received <span className="mint">✓</span></div><strong id="stat-completed">{number(completed)}</strong><div className="stat-caption"><span className="tiny-dot" /> Post-tool events received</div></article>
    <article className="stat"><div className="stat-label">Awaiting result <span className="amber">◷</span></div><strong id="stat-awaiting">{number(calls.length - completed)}</strong><div className="stat-caption">No matching result in this window</div></article>
    <article className="stat"><div className="stat-label">Median duration <span>◴</span></div><strong id="stat-duration">{duration(median)}</strong><div className="stat-caption">Time between paired hook events</div></article>
  </div>;
}
