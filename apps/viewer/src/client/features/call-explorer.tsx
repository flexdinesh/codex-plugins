import { useEffect } from "react";
import { CallEmptyState, CallTable, CallTableFooter } from "../components/call-table.tsx";
import { Filters } from "../components/filters.tsx";
import { number } from "../format.ts";
import { useViewerActions, useViewerFocus, useViewerState } from "../state/viewer-context.ts";

export function CallExplorer() {
  const { calls, snapshot, filters, options, limit, selectedCallId, updated } = useViewerState();
  const { changeFilter, resetFilters, openCall, showMore } = useViewerActions();
  const { searchRef } = useViewerFocus();

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key === "/" && !selectedCallId && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [selectedCallId, searchRef]);

  return (
    <section className="panel calls-panel" aria-labelledby="calls-heading">
      <div className="calls-heading">
        <div>
          <h2 id="calls-heading">Call explorer <span id="shown-count" className="count-badge">{number(calls.length)}</span></h2>
          <p>Click a call to inspect its input, result, and original events.</p>
        </div>
        <span id="updated" className="updated" aria-live="polite">{updated}</span>
      </div>
      <Filters
        filters={filters} options={options} homeDirectory={snapshot?.homeDirectory}
        searchRef={searchRef} onChange={changeFilter} onClear={resetFilters}
      />
      <CallTable
        calls={calls.slice(0, limit)} homeDirectory={snapshot?.homeDirectory}
        selected={selectedCallId} onOpen={openCall}
      />
      <CallEmptyState snapshot={snapshot} count={calls.length} />
      <CallTableFooter snapshot={snapshot} hasMore={calls.length > limit} onMore={showMore} />
    </section>
  );
}
