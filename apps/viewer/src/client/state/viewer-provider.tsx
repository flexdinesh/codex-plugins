import { useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import { useSnapshot } from "../hooks/use-snapshot.ts";
import { filterCalls, filterOptions } from "./filters.ts";
import { ViewerActionsContext, ViewerFocusContext, ViewerStateContext } from "./viewer-context.ts";
import type { ViewerActions } from "./viewer-context.ts";
import { initialViewerState, viewerReducer } from "./viewer-reducer.ts";

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(viewerReducer, initialViewerState);
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  const urlInitialized = useRef(false);
  useSnapshot(state.live, dispatch);

  const dataset = state.snapshot?.harnesses.find((candidate) => candidate.harness === state.selectedHarness);
  const options = useMemo(() => filterOptions(dataset), [dataset]);
  const calls = useMemo(
    () => filterCalls(dataset?.calls ?? [], state.filters, Date.now()),
    [dataset, state.filters, state.updated],
  );
  const selectedCall = dataset?.calls.find((call) => call.id === state.selectedCallId);
  const value = useMemo(() => ({ ...state, calls, options, selectedCall, dataset }), [state, calls, options, selectedCall, dataset]);
  const focus = useMemo(() => ({ searchRef, returnFocusRef }), []);
  const actions = useMemo<ViewerActions>(() => ({
    toggleLive: () => dispatch({ type: "liveToggled" }),
    changeFilter: (key, value) => dispatch({ type: "filterChanged", key, value }),
    resetFilters: () => dispatch({ type: "filtersReset" }),
    showMore: () => dispatch({ type: "moreRequested" }),
    openCall: (id, trigger) => {
      returnFocusRef.current = trigger;
      dispatch({ type: "callSelected", id });
    },
    closeInspector: () => dispatch({ type: "inspectorClosed" }),
    selectPayloadTab: (tab) => dispatch({ type: "payloadTabChanged", tab }),
    selectHarness: (harness) => dispatch({ type: "harnessSelected", harness }),
  }), []);

  useEffect(() => {
    if (!state.snapshot || urlInitialized.current) return;
    urlInitialized.current = true;
    const requested = new URLSearchParams(window.location.search).get("harness");
    if (requested === "codex" || requested === "opencode") dispatch({ type: "harnessSelected", harness: requested });
  }, [state.snapshot]);

  useEffect(() => {
    if (!state.selectedHarness) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("harness") === state.selectedHarness) return;
    url.searchParams.set("harness", state.selectedHarness);
    window.history.replaceState(null, "", url);
  }, [state.selectedHarness]);

  return (
    <ViewerStateContext value={value}>
      <ViewerActionsContext value={actions}>
        <ViewerFocusContext value={focus}>{children}</ViewerFocusContext>
      </ViewerActionsContext>
    </ViewerStateContext>
  );
}
