import { callContext, matchesContext } from "../../model.ts";
import type { HarnessDataset, ToolCall } from "../../model.ts";

export type FilterValues = {
  search: string;
  status: string;
  tool: string;
  session: string;
  range: string;
  directory: string;
  repository: string;
  agent: string;
};

export type FilterOptions = {
  tool: string[];
  session: string[];
  directory: string[];
  repository: string[];
  agent: string[];
};

export const emptyFilters: FilterValues = {
  search: "", status: "all", tool: "all", session: "all",
  range: "all", directory: "all", repository: "all", agent: "all",
};

export function filterOptions(dataset: HarnessDataset | undefined): FilterOptions {
  const calls = dataset?.calls ?? [];
  const sorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
  return {
    tool: sorted(calls.map((call) => call.tool)),
    session: sorted(calls.map((call) => call.session)),
    directory: sorted(calls.map((call) => callContext(call).directory || "unknown")),
    repository: sorted(calls.map((call) => callContext(call).root || "unknown")),
    agent: sorted(calls.map((call) => call.agent)),
  };
}

export function normalizeFilters(filters: FilterValues, options: FilterOptions): FilterValues {
  const normalized = {
    ...filters,
    tool: options.tool.includes(filters.tool) ? filters.tool : "all",
    session: options.session.includes(filters.session) ? filters.session : "all",
    directory: options.directory.includes(filters.directory) ? filters.directory : "all",
    repository: options.repository.includes(filters.repository) ? filters.repository : "all",
    agent: options.agent.includes(filters.agent) ? filters.agent : "all",
  };
  return normalized.tool === filters.tool && normalized.session === filters.session
    && normalized.directory === filters.directory && normalized.repository === filters.repository && normalized.agent === filters.agent
    ? filters : normalized;
}

export function filterCalls(calls: ToolCall[], filters: FilterValues, now: number): ToolCall[] {
  const query = filters.search.toLowerCase().trim();
  const cutoff = filters.range === "all" ? -Infinity : now - Number(filters.range) * 3600_000;
  return calls.filter((call) =>
    (filters.status === "all" || call.status === filters.status)
    && (filters.tool === "all" || call.tool === filters.tool)
    && (filters.session === "all" || call.session === filters.session)
    && (filters.agent === "all" || call.agent === filters.agent)
    && matchesContext(call, filters.directory, filters.repository)
    && Date.parse(call.time) >= cutoff
    && (!query || JSON.stringify(call).toLowerCase().includes(query)),
  );
}
