import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return <>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Tool Logger home"><span className="brand-mark">t<span>l</span></span><span>tool<span className="brand-sub">logger</span></span></a>
      <div className="workspace-label"><span className="workspace-icon">⌘</span><div>Local workspace<small>Personal environment</small></div></div>
      <div className="nav-label">OBSERVE</div>
      <a className="nav-active" href="/"><span>▤</span> Tool activity <span className="nav-arrow">↗</span></a>
      <div className="sidebar-note"><span className="tiny-dot" /> Your tools, on your machine.<p>A live window into what Codex is doing.</p></div>
      <div className="sidebar-bottom"><span className="local-mark">◉</span><div>Local only<small>Logs never leave this device</small></div></div>
    </aside>
    <div className="shell">
      <header className="topbar"><div><span className="crumb">Workspace</span><span className="slash">/</span><span>Tool activity</span></div><span className="local-badge">● LOCAL</span></header>
      <main>{children}</main>
    </div>
  </>;
}
