import type { Snapshot } from "../../model.ts";
import { emptyFilters, filterOptions, normalizeFilters } from "./filters.ts";
import type { FilterValues } from "./filters.ts";

export type PayloadTab = "input" | "output" | "raw";

export type ViewerState = {
  snapshot: Snapshot | undefined;
  live: boolean;
  error: string;
  updated: string;
  filters: FilterValues;
  limit: number;
  selectedCallId: string | null;
  payloadTab: PayloadTab;
};

export type ViewerAction =
  | { type: "snapshotReceived"; snapshot: Snapshot; updated: string }
  | { type: "connectionFailed"; message: string }
  | { type: "liveToggled" }
  | { type: "filterChanged"; key: keyof FilterValues; value: string }
  | { type: "filtersReset" }
  | { type: "moreRequested" }
  | { type: "callSelected"; id: string }
  | { type: "inspectorClosed" }
  | { type: "payloadTabChanged"; tab: PayloadTab };

export const initialViewerState: ViewerState = {
  snapshot: undefined,
  live: true,
  error: "",
  updated: "Connecting…",
  filters: emptyFilters,
  limit: 100,
  selectedCallId: null,
  payloadTab: "input",
};

export function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case "snapshotReceived": {
      const snapshot = JSON.stringify(state.snapshot) === JSON.stringify(action.snapshot)
        ? state.snapshot : action.snapshot;
      const selectedCallId = snapshot?.calls.some((call) => call.id === state.selectedCallId)
        ? state.selectedCallId : null;
      return {
        ...state,
        snapshot,
        filters: snapshot === state.snapshot ? state.filters : normalizeFilters(state.filters, filterOptions(snapshot)),
        selectedCallId,
        payloadTab: selectedCallId ? state.payloadTab : "input",
        error: "",
        updated: action.updated,
      };
    }
    case "connectionFailed":
      return { ...state, error: action.message, updated: "Connection interrupted" };
    case "liveToggled":
      return { ...state, live: !state.live };
    case "filterChanged":
      return { ...state, filters: { ...state.filters, [action.key]: action.value }, limit: 100 };
    case "filtersReset":
      return { ...state, filters: emptyFilters, limit: 100 };
    case "moreRequested":
      return { ...state, limit: state.limit + 100 };
    case "callSelected":
      return state.snapshot?.calls.some((call) => call.id === action.id)
        ? { ...state, selectedCallId: action.id, payloadTab: "input" } : state;
    case "inspectorClosed":
      return { ...state, selectedCallId: null, payloadTab: "input" };
    case "payloadTabChanged":
      return state.selectedCallId ? { ...state, payloadTab: action.tab } : state;
  }
}
