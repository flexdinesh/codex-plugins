import type { Ref } from "react";
import { displayPath, repositoryLabel } from "../../model.ts";
import type { FilterOptions, FilterValues } from "../state/filters.ts";

export function Filters({ filters, options, homeDirectory, searchRef, onChange, onClear }: {
  filters: FilterValues;
  options: FilterOptions;
  homeDirectory: string | undefined;
  searchRef: Ref<HTMLInputElement>;
  onChange: (key: keyof FilterValues, value: string) => void;
  onClear: () => void;
}) {
  const active = Boolean(filters.search.trim()) || Object.entries(filters).some(([key, value]) => key !== "search" && value !== "all");
  return <>
    <div className="filters">
      <label className="search"><span>⌕</span><input ref={searchRef} id="search" type="search" placeholder="Search tools, commands, or content…" aria-label="Search tool calls" value={filters.search} onChange={(event) => onChange("search", event.currentTarget.value)} /><kbd>/</kbd></label>
      <select id="status" aria-label="Filter by status" value={filters.status} onChange={(event) => onChange("status", event.currentTarget.value)}><option value="all">All statuses</option><option value="completed">Result received</option><option value="awaiting">Awaiting result</option></select>
      <select id="tool" aria-label="Filter by tool" value={filters.tool} onChange={(event) => onChange("tool", event.currentTarget.value)}><option value="all">All tools</option>{options.tool.map((tool) => <option key={tool} value={tool}>{tool === "unknown" ? "Not recorded" : tool}</option>)}</select>
      <select id="session" aria-label="Filter by session" value={filters.session} onChange={(event) => onChange("session", event.currentTarget.value)}><option value="all">All sessions</option>{options.session.map((session) => <option key={session} value={session}>{session === "unknown" ? "Not recorded" : session}</option>)}</select>
      <select id="range" aria-label="Filter by time" value={filters.range} onChange={(event) => onChange("range", event.currentTarget.value)}><option value="all">All time</option><option value="1">Last hour</option><option value="24">Last 24 hours</option></select>
      <button id="clear" className="text-button" type="button" hidden={!active} onClick={onClear}>Reset</button>
    </div>
    <div className="context-filters">
      <label>Repository<select id="repository" aria-label="Filter by repository" value={filters.repository} onChange={(event) => onChange("repository", event.currentTarget.value)}><option value="all">All repositories</option>{options.repository.map((root) => <option key={root} value={root}>{root === "unknown" ? "No repository recorded" : repositoryLabel(root, options.repository, homeDirectory)}</option>)}</select></label>
      <label>Directory<select id="directory" aria-label="Filter by directory" value={filters.directory} onChange={(event) => onChange("directory", event.currentTarget.value)}><option value="all">All directories</option>{options.directory.map((directory) => <option key={directory} value={directory}>{directory === "unknown" ? "No directory recorded" : displayPath(directory, homeDirectory)}</option>)}</select></label>
    </div>
  </>;
}
