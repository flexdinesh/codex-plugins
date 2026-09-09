import type { RefObject } from "react";
import { callContext, displayPath, repositoryName } from "../../model.ts";
import type { ToolCall } from "../../model.ts";
import { duration } from "../format.ts";
import { useDialogFocus } from "../hooks/use-dialog-focus.ts";
import type { PayloadTab } from "../state/viewer-reducer.ts";
import { CallStatus } from "./call-status.tsx";
import { GitSnapshots } from "./git-snapshots.tsx";
import { MetadataFields } from "./metadata-fields.tsx";
import { PayloadPanel } from "./payload-panel.tsx";

export function Inspector({ call, homeDirectory, tab, onTabChange, returnFocusRef, searchRef, onClose }: {
  call: ToolCall;
  homeDirectory: string | undefined;
  tab: PayloadTab;
  onTabChange: (tab: PayloadTab) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const { dialogRef, closeRef } = useDialogFocus({ onClose, returnFocusRef, searchRef });
  const context = callContext(call);
  return (
    <>
      <div id="overlay" className="overlay" onClick={onClose} />
      <aside ref={dialogRef} id="inspector" className="inspector" aria-label="Tool call details" role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="inspector-heading">
          <span className="eyebrow">CALL DETAILS</span>
          <button ref={closeRef} id="close" type="button" className="icon-button" aria-label="Close call details" onClick={onClose}>×</button>
        </div>
        <h2 id="detail-tool">{call.tool}</h2>
        <div id="detail-status"><CallStatus status={call.status} /></div>
        <dl id="metadata">
          <MetadataFields values={[
            ["Time", new Date(call.time).toLocaleString()],
            ["Duration", duration(call.durationMs)],
            ["Session", call.session || "Not recorded"],
            ["Turn", call.turn || "Not recorded"],
            ["Directory", displayPath(context.directory, homeDirectory) || "Not recorded"],
            ["Repository", repositoryName(context.root) || "Not recorded"],
            ["Branch", context.branch || "Not recorded"],
          ]} />
        </dl>
        <GitSnapshots call={call} homeDirectory={homeDirectory} />
        <PayloadPanel call={call} tab={tab} onTabChange={onTabChange} />
        <p className="detail-note">“Result received” means a post-tool event was logged. Inspect the result to determine whether the tool succeeded.</p>
      </aside>
    </>
  );
}
