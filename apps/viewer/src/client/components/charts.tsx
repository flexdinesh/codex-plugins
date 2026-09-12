import type { ToolCall } from "../../model.ts";
import { clock } from "../format.ts";
import { Card } from "./ui/card.tsx";

function ActivityChart({ calls }: { calls: ToolCall[] }) {
  const times = calls.map((call) => Date.parse(call.time));
  const end = times.length ? Math.max(...times) : Date.now();
  const start = times.length ? Math.min(...times) : end - 3600_000;
  const width = Math.max(end - start, 60_000);
  const buckets = Array.from({ length: 36 }, () => 0);
  for (const time of times) {
    const index = Math.min(35, Math.floor(((time - start) / width) * 36));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  const peak = Math.max(1, ...buckets);
  return (
    <Card className="activity-panel p-5">
      <div className="panel-heading flex items-center justify-between"><h2 className="text-base font-semibold">Activity over time</h2><span className="legend flex items-center gap-1.5 text-xs text-muted"><i className="size-2 rounded-sm bg-chart-strong" /> Tool calls</span></div>
      <div id="activity" className="activity-bars" role="img" aria-label={`${calls.length} calls between ${clock(start)} and ${clock(end)}`}>
        {buckets.map((count, index) => <div key={index} className="activity-bar" style={{ height: `${(count / peak) * 100}%` }} title={`${clock(start + (index / 36) * width)} · ${count} call${count === 1 ? "" : "s"}`} />)}
      </div>
      <div className="chart-axis mt-3 flex justify-between text-xs text-muted"><span id="chart-from">{calls.length ? clock(start) : "No events yet"}</span><span id="chart-to">{calls.length ? clock(end) : "Now"}</span></div>
    </Card>
  );
}

function ToolUsageChart({ calls, onTool }: { calls: ToolCall[]; onTool: (tool: string) => void }) {
  const counts = new Map<string, number>();
  for (const call of calls) counts.set(call.tool, (counts.get(call.tool) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <Card className="tools-panel p-5">
      <div className="panel-heading flex items-center justify-between"><h2 className="text-base font-semibold">Tools in use</h2><span id="tool-count" className="text-xs text-muted">{counts.size} tools</span></div>
      <div id="tools" className="tool-bars mt-5 flex flex-col gap-3">{top.map(([tool, count]) => <button key={tool} className="tool-row grid grid-cols-[minmax(95px,1fr)_1fr_25px] items-center gap-3 text-left text-sm text-secondary outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" type="button" title={`Filter by ${tool}`} onClick={() => onTool(tool)}><span className="tool-name truncate">{tool}</span><span className="tool-track h-1.5 overflow-hidden rounded-sm bg-surface-secondary"><span className="tool-fill block h-full rounded-sm bg-chart" style={{ width: `${(count / Math.max(1, top[0]?.[1] ?? 1)) * 100}%` }} /></span><span className="text-right text-xs tabular-nums">{count}</span></button>)}{!top.length && <p className="text-sm text-muted">Tools appear here as calls arrive.</p>}</div>
    </Card>
  );
}

export function Charts({ calls, onTool }: { calls: ToolCall[]; onTool: (tool: string) => void }) {
  return (
    <section className="charts mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]" aria-label="Activity overview">
      <ActivityChart calls={calls} />
      <ToolUsageChart calls={calls} onTool={onTool} />
    </section>
  );
}
