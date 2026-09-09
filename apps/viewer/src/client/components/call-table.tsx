import { callContext, displayPath, repositoryName } from "../../model.ts";
import type { Snapshot, ToolCall } from "../../model.ts";
import { clock, duration, number, summary } from "../format.ts";
import { CallStatus } from "./call-status.tsx";

type CallRowProps = {
  call: ToolCall;
  homeDirectory: string | undefined;
  selected: boolean;
  onOpen: (id: string, row: HTMLTableRowElement) => void;
};

function CallRow({ call, homeDirectory, selected, onOpen }: CallRowProps) {
  const context = callContext(call);
  const pathLabel = (path: string) => displayPath(path, homeDirectory);
  const repository = context.root
    ? repositoryName(context.root) + (context.branch ? " · " + context.branch : "")
    : "No repository recorded";
  return (
    <tr
      className={"call-row" + (selected ? " selected" : "")} tabIndex={0}
      aria-label={`Inspect ${call.tool} at ${clock(call.time)}`}
      onClick={(event) => onOpen(call.id, event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(call.id, event.currentTarget);
        }
      }}
    >
      <td>
        <div className="tool-cell">
          <span className="tool-icon">{call.tool === "Bash" ? ">_" : call.tool === "apply_patch" ? "±" : "⌕"}</span>
          <div className="tool-text">
            <div className="tool-title">{call.tool}</div>
            <div className="tool-summary">{summary(call)}</div>
          </div>
        </div>
      </td>
      <td className="repository-cell" title={[pathLabel(context.root), context.branch, pathLabel(context.directory)].filter(Boolean).join("\n")}>
        <div className="repository-name">{repository}</div>
        <div className="directory-path">{pathLabel(context.directory) || "No directory recorded"}</div>
      </td>
      <td><CallStatus status={call.status} /></td>
      <td>{duration(call.durationMs)}</td>
      <td title={call.session}><span className="session-tag">{call.session ? call.session.slice(0, 14) : "—"}</span></td>
      <td className="cell-time">{clock(call.time)}</td><td className="arrow-cell">↗</td>
    </tr>
  );
}

export function CallTable({ calls, homeDirectory, selected, onOpen }: {
  calls: ToolCall[];
  homeDirectory: string | undefined;
  selected: string | null;
  onOpen: CallRowProps["onOpen"];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>TOOL / INPUT</th><th>REPOSITORY / DIRECTORY</th><th>STATUS</th>
            <th>DURATION</th><th>SESSION</th><th>TIME</th><th><span className="sr-only">Inspect</span></th>
          </tr>
        </thead>
        <tbody id="rows">
          {calls.map((call) => <CallRow key={call.id} call={call} homeDirectory={homeDirectory} selected={selected === call.id} onOpen={onOpen} />)}
        </tbody>
      </table>
    </div>
  );
}

export function CallEmptyState({ snapshot, count }: { snapshot: Snapshot | undefined; count: number }) {
  const hasCalls = Boolean(snapshot?.calls.length);
  const message = hasCalls
    ? "Try a different search or reset the filters to see all calls."
    : snapshot?.missing
      ? "Enable and trust the Tool Call Logger plugin in Codex. The log file will be created on the first call."
      : "New tool calls will appear automatically. Only complete, valid tool events are shown.";
  return (
    <div id="empty" className="empty" hidden={!snapshot || count > 0}>
      <div className="empty-icon">⌁</div>
      <h3 id="empty-title">{hasCalls ? "No matching calls" : "Waiting for your first tool call"}</h3>
      <p id="empty-message">{message}</p>
    </div>
  );
}

export function CallTableFooter({ snapshot, hasMore, onMore }: {
  snapshot: Snapshot | undefined;
  hasMore: boolean;
  onMore: () => void;
}) {
  const note = snapshot?.truncated
    ? "Showing recent events only · older log data is outside this window"
    : `${snapshot?.skipped ? `${snapshot.skipped} malformed records skipped · ` : ""}Latest 2,000 log events · refreshes every 2 seconds`;
  return (
    <footer className="table-footer">
      <span id="window-note">{note}</span>
      <button id="more" className="text-button" type="button" hidden={!hasMore} onClick={onMore}>Show more ↓</button>
      <span id="event-count">{number(snapshot?.totalEvents ?? 0)} events</span>
    </footer>
  );
}
