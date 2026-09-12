import { Code2, HardDrive, ShieldCheck, TerminalSquare } from "lucide-react";
import type { ReactNode } from "react";
import type { HarnessDataset } from "../../model.ts";
import { useViewerActions, useViewerState } from "../state/viewer-context.ts";
import { Select } from "./ui/select.tsx";

function HarnessIcon({ harness }: { harness: HarnessDataset["harness"] }) {
  return harness === "codex" ? <Code2 aria-hidden="true" className="size-5" /> : <TerminalSquare aria-hidden="true" className="size-5" />;
}

function HarnessNavigation() {
  const { snapshot, selectedHarness } = useViewerState();
  const { selectHarness } = useViewerActions();
  const harnesses = snapshot?.harnesses ?? [];
  return <nav className="mt-8 flex flex-col gap-1" aria-label="Available harnesses">
    <div className="nav-label mb-2 hidden px-3 text-xs font-semibold tracking-widest text-sidebar-muted lg:block">HARNESSES</div>
    {harnesses.map((dataset) => <button key={dataset.harness} type="button"
      className={`harness-nav flex size-10 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-surface hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring lg:h-10 lg:w-full lg:justify-start lg:gap-3 lg:px-3 ${selectedHarness === dataset.harness ? "bg-sidebar-surface text-sidebar-foreground" : ""}`}
      aria-current={selectedHarness === dataset.harness ? "page" : undefined} aria-label={`${dataset.label} tool activity`}
      onClick={() => selectHarness(dataset.harness)}>
      <HarnessIcon harness={dataset.harness} /><span className="hidden text-sm font-medium lg:block">{dataset.label}</span>
      {dataset.apiVersion && <span className="ml-auto hidden font-mono text-xs text-sidebar-muted lg:block">V{dataset.apiVersion}</span>}
    </button>)}
    {snapshot && harnesses.length === 0 && <p className="hidden px-3 text-xs leading-5 text-sidebar-muted lg:block">No harness logs found.</p>}
  </nav>;
}

function MobileHarnessNavigation() {
  const { snapshot, selectedHarness } = useViewerState();
  const { selectHarness } = useViewerActions();
  const harnesses = snapshot?.harnesses ?? [];
  if (harnesses.length === 0) return <span className="text-sm text-muted">No harness data</span>;
  return <Select id="mobile-harness" className="max-w-40 sm:hidden" aria-label="Select harness" value={selectedHarness ?? ""}
    onChange={(event) => {
      const value = event.currentTarget.value;
      if (value === "codex" || value === "opencode") selectHarness(value);
    }}>
    {harnesses.map((dataset) => <option key={dataset.harness} value={dataset.harness}>{dataset.label}{dataset.apiVersion ? ` V${dataset.apiVersion}` : ""}</option>)}
  </Select>;
}

export function Layout({ children }: { children: ReactNode }) {
  const { dataset } = useViewerState();
  return <>
    <aside className="sidebar fixed inset-y-0 left-0 z-20 hidden w-16 flex-col bg-sidebar px-3 py-6 text-sidebar-foreground sm:flex lg:w-56 lg:px-5 lg:py-8">
      <a className="brand flex items-center gap-3" href="/" aria-label="Tool Logger home"><span className="brand-mark flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-xl font-bold tracking-[-0.12em] text-sidebar-accent-foreground">tl</span><span className="hidden text-xl font-semibold tracking-tight lg:block">tool<span className="brand-sub block text-sm font-normal tracking-widest text-sidebar-muted">logger</span></span></a>
      <HarnessNavigation />
      <div className="sidebar-note mt-8 hidden px-3 text-xs leading-5 text-sidebar-foreground lg:block"><span className="tiny-dot mr-1.5 inline-block size-1.5 rounded-full bg-success" /> Your tools, on your machine.<p className="mt-2 text-sm text-sidebar-muted">Harness-native activity without leaving this device.</p></div>
      <div className="sidebar-bottom mt-auto hidden items-center gap-3 border-t border-sidebar-border px-1 pt-5 text-sm lg:flex"><ShieldCheck aria-hidden="true" className="size-5 text-sidebar-accent" /><div>Local only<small className="mt-1 block text-xs text-sidebar-muted">Logs never leave this device</small></div></div>
    </aside>
    <div className="shell min-h-screen sm:ml-16 lg:ml-56">
      <header className="topbar flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-4 text-sm font-medium sm:px-6 lg:px-10"><div className="hidden sm:block"><span className="crumb text-muted">Workspace</span><span className="slash mx-3 text-border-strong">/</span><span>{dataset?.label ?? "Tool activity"}</span></div><MobileHarnessNavigation /><span className="local-badge ml-auto inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs font-semibold tracking-wider text-secondary"><HardDrive aria-hidden="true" className="size-3.5 text-accent" /> LOCAL</span></header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  </>;
}
