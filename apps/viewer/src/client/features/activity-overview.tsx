import { displayPath } from "../../model.ts";
import { Charts } from "../components/charts.tsx";
import { Stats } from "../components/stats.tsx";
import { useViewerActions, useViewerState } from "../state/viewer-context.ts";

export function ActivityHeading() {
  const { snapshot, live } = useViewerState();
  const { toggleLive } = useViewerActions();
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">OBSERVABILITY</div>
        <h1>Tool activity<span className="heading-dot">.</span></h1>
        <p>Follow the work. See what happened, and what came back.</p>
      </div>
      <div className="heading-actions">
        <span id="demo" className="demo-badge" hidden={!snapshot?.demo}>DEMO DATA</span>
        <button id="live" className="live-button" type="button" aria-pressed={live} onClick={toggleLive}>
          <span className="live-dot" />
          <span id="live-label">{live ? "Live updates" : "Updates paused"}</span>
          <span className="pause-icon">Ⅱ</span>
        </button>
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
  return <div id="error" className="notice error" role="alert" hidden={!error}>{error}</div>;
}

export function LogSource() {
  const { snapshot } = useViewerState();
  const source = snapshot ? displayPath(snapshot.source, snapshot.homeDirectory) : "Reading local log…";
  return (
    <div className="source-line">
      <span>↳</span><span id="source" title={source}>{source}</span>
      <span className="read-only">READ ONLY</span>
    </div>
  );
}
