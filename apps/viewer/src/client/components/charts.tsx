import type { ToolCall } from "../../model.ts";
import { clock } from "../format.ts";

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
    <article className="panel activity-panel">
      <div className="panel-heading"><h2>Activity over time</h2><span className="legend"><i /> Tool calls</span></div>
      <div id="activity" className="activity-bars" role="img" aria-label={`${calls.length} calls between ${clock(start)} and ${clock(end)}`}>
        {buckets.map((count, index) => <div key={index} className="activity-bar" style={{ height: `${(count / peak) * 100}%` }} title={`${clock(start + (index / 36) * width)} · ${count} call${count === 1 ? "" : "s"}`} />)}
      </div>
      <div className="chart-axis"><span id="chart-from">{calls.length ? clock(start) : "No events yet"}</span><span id="chart-to">{calls.length ? clock(end) : "Now"}</span></div>
    </article>
  );
}

function ToolUsageChart({ calls, onTool }: { calls: ToolCall[]; onTool: (tool: string) => void }) {
  const counts = new Map<string, number>();
  for (const call of calls) counts.set(call.tool, (counts.get(call.tool) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <article className="panel tools-panel">
      <div className="panel-heading"><h2>Tools in use</h2><span id="tool-count" className="muted">{counts.size} tools</span></div>
      <div id="tools" className="tool-bars">{top.map(([tool, count]) => <button key={tool} className="tool-row" type="button" title={`Filter by ${tool}`} onClick={() => onTool(tool)}><span className="tool-name">{tool}</span><span className="tool-track"><span className="tool-fill" style={{ width: `${(count / Math.max(1, top[0]?.[1] ?? 1)) * 100}%` }} /></span><span>{count}</span></button>)}{!top.length && <p className="muted">Tools appear here as calls arrive.</p>}</div>
    </article>
  );
}

export function Charts({ calls, onTool }: { calls: ToolCall[]; onTool: (tool: string) => void }) {
  return (
    <section className="charts" aria-label="Activity overview">
      <ActivityChart calls={calls} />
      <ToolUsageChart calls={calls} onTool={onTool} />
    </section>
  );
}
