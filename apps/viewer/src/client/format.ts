import { isObject } from "../model.ts";
import type { ToolCall } from "../model.ts";

export function duration(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
export const clock = (date: string | number) =>
  new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const number = (value: number) => value.toLocaleString();

export function summary(call: ToolCall): string {
  if (isObject(call.input)) {
    for (const key of ["command", "cmd", "query", "path", "file_path", "url"]) {
      const value = call.input[key];
      if (typeof value === "string") return value.replace(/\s+/g, " ");
    }
  }
  return call.input === null ? "No input recorded" : JSON.stringify(call.input) ?? "";
}
