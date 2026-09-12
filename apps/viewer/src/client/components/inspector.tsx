import { X } from "lucide-react";
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
import { Button } from "./ui/button.tsx";
import { SheetContent, SheetHeader, SheetOverlay } from "./ui/sheet.tsx";

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
      <SheetOverlay id="overlay" onClick={onClose} />
      <SheetContent ref={dialogRef} id="inspector" aria-label="Tool call details">
        <SheetHeader className="inspector-heading mb-4">
          <span className="eyebrow text-xs font-semibold tracking-widest text-secondary">CALL DETAILS</span>
          <Button ref={closeRef} id="close" variant="ghost" size="icon" className="size-10" aria-label="Close call details" onClick={onClose}><X aria-hidden="true" /></Button>
        </SheetHeader>
        <h2 id="detail-tool" className="mb-3 text-xl font-semibold tracking-tight wrap-break-word">{call.tool}</h2>
        <div id="detail-status"><CallStatus status={call.status} /></div>
        <dl id="metadata" className="my-6 grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-y border-border py-5 text-sm">
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
        <p className="detail-note text-xs leading-5 text-muted">“Result received” means a post-tool event was logged. Inspect the result to determine whether the tool succeeded.</p>
      </SheetContent>
    </>
  );
}
