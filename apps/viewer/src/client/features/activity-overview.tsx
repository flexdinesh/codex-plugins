import { HardDrive, Pause, Play, TerminalSquare } from "lucide-react";
import { displayPath } from "../../model.ts";
import { Charts } from "../components/charts.tsx";
import { Stats } from "../components/stats.tsx";
import { Alert } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { useViewerActions, useViewerState } from "../state/viewer-context.ts";

export function ActivityHeading() {
  const { snapshot, live } = useViewerState();
  const { toggleLive } = useViewerActions();
  return (
    <div className="page-heading mb-8 flex items-start justify-between gap-4">
      <div>
        <div className="eyebrow text-xs font-semibold tracking-widest text-secondary">OBSERVABILITY</div>
        <h1 className="my-2 text-2xl font-semibold tracking-tight sm:text-3xl">Tool activity<span className="heading-dot text-accent">.</span></h1>
        <p className="max-w-md text-sm leading-6 text-muted">Follow the work. See what happened, and what came back.</p>
      </div>
      <div className="heading-actions flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        <Badge id="demo" variant="warning" className="tracking-wide" hidden={!snapshot?.demo}>DEMO DATA</Badge>
        <Button id="live" variant="outline" size="compact" className="live-button" aria-pressed={live} onClick={toggleLive}>
          <span className={`live-dot size-1.5 rounded-full ${live ? "bg-success shadow-live" : "bg-warning"}`} />
          <span id="live-label">{live ? "Live updates" : "Updates paused"}</span>
          {live ? <Pause aria-hidden="true" className="pause-icon ml-1 hidden size-3.5 text-muted sm:block" /> : <Play aria-hidden="true" className="pause-icon ml-1 hidden size-3.5 text-muted sm:block" />}
        </Button>
      </div>
    </div>
  );
}

export function ActivityOverview() {
  const { calls } = useViewerState();
  const { changeFilter } = useViewerActions();
  return <><Stats calls={calls} /><Charts calls={calls} onTool={(tool) => changeFilter("tool", tool)} /></>;
}

export function ConnectionNotice() {
  const { error } = useViewerState();
  return <Alert id="error" className="mb-5" hidden={!error}>{error}</Alert>;
}

export function LogSource() {
  const { snapshot } = useViewerState();
  const source = snapshot ? displayPath(snapshot.source, snapshot.homeDirectory) : "Reading local log…";
  return (
    <div className="source-line mt-5 flex items-center gap-2 font-mono text-xs text-muted">
      <TerminalSquare aria-hidden="true" className="size-4 shrink-0" /><span id="source" className="truncate" title={source}>{source}</span>
      <span className="read-only ml-auto hidden items-center gap-1.5 whitespace-nowrap font-sans font-semibold tracking-wider sm:inline-flex"><HardDrive aria-hidden="true" className="size-3.5" /> READ ONLY</span>
    </div>
  );
}
