import { useMemo, useReducer, useRef } from "react";
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
  useSnapshot(state.live, dispatch);

  const options = useMemo(() => filterOptions(state.snapshot), [state.snapshot]);
  const calls = useMemo(
    () => filterCalls(state.snapshot?.calls ?? [], state.filters, Date.now()),
    [state.snapshot, state.filters, state.updated],
  );
  const selectedCall = state.snapshot?.calls.find((call) => call.id === state.selectedCallId);
  const value = useMemo(() => ({ ...state, calls, options, selectedCall }), [state, calls, options, selectedCall]);
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
  }), []);

  return (
    <ViewerStateContext value={value}>
      <ViewerActionsContext value={actions}>
        <ViewerFocusContext value={focus}>{children}</ViewerFocusContext>
      </ViewerActionsContext>
    </ViewerStateContext>
  );
}
