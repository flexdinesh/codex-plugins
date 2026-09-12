import { ChevronDown, ExternalLink, FilePenLine, Radar, Search, Terminal } from "lucide-react";
import { callContext, displayPath, repositoryName } from "../../model.ts";
import type { Snapshot, ToolCall } from "../../model.ts";
import { clock, duration, number, summary } from "../format.ts";
import { CallStatus } from "./call-status.tsx";
import { Button } from "./ui/button.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from "./ui/table.tsx";

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
  const ToolIcon = call.tool === "Bash" ? Terminal : call.tool === "apply_patch" ? FilePenLine : Search;
  return (
    <TableRow
      className={`call-row cursor-pointer hover:bg-surface-secondary ${selected ? "selected bg-accent-soft" : ""}`} tabIndex={0}
      aria-label={`Inspect ${call.tool} at ${clock(call.time)}`}
      onClick={(event) => onOpen(call.id, event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(call.id, event.currentTarget);
        }
      }}
    >
      <TableCell className="max-w-sm min-w-56 pl-6">
        <div className="tool-cell flex items-center gap-3">
          <span className="tool-icon flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-secondary text-accent"><ToolIcon aria-hidden="true" className="size-4" /></span>
          <div className="tool-text min-w-0">
            <div className="tool-title text-sm font-medium text-foreground">{call.tool}</div>
            <div className="tool-summary mt-1 max-w-sm truncate font-mono text-xs text-muted">{summary(call)}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="repository-cell max-w-64" title={[pathLabel(context.root), context.branch, pathLabel(context.directory)].filter(Boolean).join("\n")}>
        <div className="repository-name max-w-60 truncate text-sm text-secondary">{repository}</div>
        <div className="directory-path mt-1 max-w-60 truncate font-mono text-xs text-muted">{pathLabel(context.directory) || "No directory recorded"}</div>
      </TableCell>
      <TableCell><CallStatus status={call.status} /></TableCell>
      <TableCell>{duration(call.durationMs)}</TableCell>
      <TableCell title={call.session}><span className="session-tag rounded-sm border border-border px-2 py-1 font-mono text-xs text-muted">{call.session ? call.session.slice(0, 14) : "—"}</span></TableCell>
      <TableCell className="cell-time tabular-nums">{clock(call.time)}</TableCell><TableCell className="arrow-cell pr-6 pl-0 text-border-strong"><ExternalLink aria-hidden="true" className="size-4" /></TableCell>
    </TableRow>
  );
}

export function CallTable({ calls, homeDirectory, selected, onOpen }: {
  calls: ToolCall[];
  homeDirectory: string | undefined;
  selected: string | null;
  onOpen: CallRowProps["onOpen"];
}) {
  return (
    <TableWrap>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">TOOL / INPUT</TableHead><TableHead>REPOSITORY / DIRECTORY</TableHead><TableHead>STATUS</TableHead>
            <TableHead>DURATION</TableHead><TableHead>SESSION</TableHead><TableHead>TIME</TableHead><TableHead><span className="sr-only">Inspect</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody id="rows">
          {calls.map((call) => <CallRow key={call.id} call={call} homeDirectory={homeDirectory} selected={selected === call.id} onOpen={onOpen} />)}
        </TableBody>
      </Table>
    </TableWrap>
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
    <div id="empty" className="empty px-6 py-12 text-center" hidden={!snapshot || count > 0}>
      <div className="empty-icon mx-auto mb-4 flex size-12 items-center justify-center rounded-lg border border-border bg-accent-soft text-accent"><Radar aria-hidden="true" className="size-5" /></div>
      <h3 id="empty-title" className="text-lg font-semibold text-foreground">{hasCalls ? "No matching calls" : "Waiting for your first tool call"}</h3>
      <p id="empty-message" className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
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
    <footer className="table-footer flex items-center justify-between gap-3 px-4 py-4 text-xs text-muted sm:px-6">
      <span id="window-note">{note}</span>
      <Button id="more" variant="ghost" size="compact" hidden={!hasMore} onClick={onMore}>Show more <ChevronDown aria-hidden="true" /></Button>
      <span id="event-count">{number(snapshot?.totalEvents ?? 0)} events</span>
    </footer>
  );
}
