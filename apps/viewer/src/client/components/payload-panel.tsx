import { useEffect, useRef, useState } from "react";
import type { ToolCall } from "../../model.ts";
import type { PayloadTab } from "../state/viewer-reducer.ts";

const tabs: { name: PayloadTab; label: string }[] = [
  { name: "input", label: "Input" },
  { name: "output", label: "Result" },
  { name: "raw", label: "Raw events" },
];

function CopyPayloadButton({ payload }: { payload: string }) {
  const [label, setLabel] = useState("Copy JSON");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    let result: string;
    try {
      await navigator.clipboard.writeText(payload);
      result = "Copied";
    } catch {
      result = "Select text to copy";
    }
    if (!mounted.current) return;
    clearTimeout(timer.current);
    setLabel(result);
    timer.current = setTimeout(() => setLabel("Copy JSON"), 1500);
  }

  return <button id="copy" className="text-button" type="button" onClick={() => { void copy(); }}>{label}</button>;
}

export function PayloadPanel({ call, tab, onTabChange }: {
  call: ToolCall;
  tab: PayloadTab;
  onTabChange: (tab: PayloadTab) => void;
}) {
  const value = tab === "input" ? call.input : tab === "output" ? call.output : { pre: call.pre, post: call.post };
  const payload = tab === "output" && !call.post
    ? "No matching PostToolUse event in the current log window."
    : JSON.stringify(value, null, 2) ?? "";
  return (
    <>
      <div className="detail-tabs" role="tablist" aria-label="Call payload">
        {tabs.map(({ name, label }) => (
          <button key={name} id={`tab-${name}`} role="tab" aria-selected={tab === name} aria-controls="payload" type="button" onClick={() => onTabChange(name)}>
            {label}
          </button>
        ))}
      </div>
      <div className="payload-heading">
        <span id="payload-label">{tab === "input" ? "TOOL INPUT" : tab === "output" ? "TOOL RESULT" : "ORIGINAL HOOK EVENTS"}</span>
        <CopyPayloadButton payload={payload} />
      </div>
      <pre id="payload" tabIndex={0} role="tabpanel" aria-labelledby={`tab-${tab}`}>{payload}</pre>
    </>
  );
}
