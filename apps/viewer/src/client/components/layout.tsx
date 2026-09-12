import { Activity, Command, ExternalLink, HardDrive, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return <>
    <aside className="sidebar fixed inset-y-0 left-0 z-20 hidden w-16 flex-col bg-sidebar px-3 py-6 text-sidebar-foreground sm:flex lg:w-56 lg:px-5 lg:py-8">
      <a className="brand flex items-center gap-3" href="/" aria-label="Tool Logger home"><span className="brand-mark flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-xl font-bold tracking-[-0.12em] text-sidebar-accent-foreground">tl</span><span className="hidden text-xl font-semibold tracking-tight lg:block">tool<span className="brand-sub block text-sm font-normal tracking-widest text-sidebar-muted">logger</span></span></a>
      <div className="workspace-label mt-9 hidden items-center gap-3 rounded-md border border-sidebar-border p-3 text-sm font-medium lg:flex"><Command aria-hidden="true" className="size-5 text-sidebar-muted" /><div>Local workspace<small className="mt-1 block text-xs font-normal text-sidebar-muted">Personal environment</small></div></div>
      <div className="nav-label mt-8 mb-3 hidden px-3 text-xs font-semibold tracking-widest text-sidebar-muted lg:block">OBSERVE</div>
      <a className="nav-active mt-8 flex size-10 items-center justify-center rounded-md bg-sidebar-surface text-sidebar-foreground lg:mt-0 lg:h-10 lg:w-full lg:justify-start lg:gap-3 lg:px-3" href="/" aria-current="page"><Activity aria-hidden="true" className="size-5 text-sidebar-accent" /><span className="hidden text-sm font-medium lg:block">Tool activity</span><ExternalLink aria-hidden="true" className="nav-arrow ml-auto hidden size-4 text-sidebar-muted lg:block" /></a>
      <div className="sidebar-note mt-8 hidden px-3 text-xs leading-5 text-sidebar-foreground lg:block"><span className="tiny-dot mr-1.5 inline-block size-1.5 rounded-full bg-success" /> Your tools, on your machine.<p className="mt-2 text-sm text-sidebar-muted">A live window into what Codex is doing.</p></div>
      <div className="sidebar-bottom mt-auto hidden items-center gap-3 border-t border-sidebar-border px-1 pt-5 text-sm lg:flex"><ShieldCheck aria-hidden="true" className="size-5 text-sidebar-accent" /><div>Local only<small className="mt-1 block text-xs text-sidebar-muted">Logs never leave this device</small></div></div>
    </aside>
    <div className="shell min-h-screen sm:ml-16 lg:ml-56">
      <header className="topbar flex h-16 items-center justify-between border-b border-border bg-surface px-4 text-sm font-medium sm:px-6 lg:px-10"><div><span className="crumb text-muted">Workspace</span><span className="slash mx-3 text-border-strong">/</span><span>Tool activity</span></div><span className="local-badge inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs font-semibold tracking-wider text-secondary"><HardDrive aria-hidden="true" className="size-3.5 text-accent" /> LOCAL</span></header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  </>;
}
