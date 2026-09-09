import { useEffect } from "react";
import type { Dispatch } from "react";
import { isSnapshot } from "../../model.ts";
import type { ViewerAction } from "../state/viewer-reducer.ts";

export function useSnapshot(live: boolean, dispatch: Dispatch<ViewerAction>) {
  useEffect(() => {
    if (!live) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    async function refresh() {
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(new DOMException("The request timed out.", "TimeoutError")), 8000);
      try {
        const response = await fetch("/api/logs", { signal: controller.signal });
        if (!response.ok) throw new Error(`Unable to read the log (HTTP ${response.status}). Check the server terminal and file permissions.`);
        const value: unknown = await response.json();
        if (!isSnapshot(value)) throw new Error("Unexpected log response.");
        if (!active) return;
        dispatch({ type: "snapshotReceived", snapshot: value, updated: `Updated ${new Date().toLocaleTimeString()}` });
      } catch (reason) {
        if (!active) return;
        dispatch({ type: "connectionFailed", message: reason instanceof Error ? reason.message : "Unable to connect to the viewer." });
      } finally {
        clearTimeout(timeout);
        if (active) timer = setTimeout(() => { void refresh(); }, 2000);
      }
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
      request?.abort();
    };
  }, [live, dispatch]);
}
