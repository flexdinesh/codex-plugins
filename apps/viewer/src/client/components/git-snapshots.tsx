import { displayPath, recordContext, repositoryName } from "../../model.ts";
import type { LogRecord, ToolCall } from "../../model.ts";
import { MetadataFields } from "./metadata-fields.tsx";

function GitSnapshot({ record, title, homeDirectory }: { record: LogRecord | null; title: string; homeDirectory: string | undefined }) {
  const git = recordContext(record);
  const pathLabel = (path: string) => displayPath(path, homeDirectory);
  return <section className="git-snapshot"><h3>{title}</h3>{!record ? <p className="detail-note">No matching hook event recorded.</p> : <>
    <dl><MetadataFields values={[
      ["Directory", pathLabel(git.directory) || "Not recorded"], ["Repository", repositoryName(git.root) || "Not recorded"],
      ["Repo root", pathLabel(git.root) || "Not recorded"], ["Branch", git.branch || "Not recorded"],
      ["Commit", git.commit || "Not recorded"], ["Upstream", git.upstream || "Not recorded"],
      ["Ahead / behind", git.divergence || "Not recorded"], ["Working tree", git.dirty === null ? "Unknown" : git.dirty ? "Has changes" : "Clean"],
    ]} /></dl>
    {git.error && <p className="git-error">Git unavailable: {git.error}</p>}
    {git.status && <details className="git-status"><summary>Recorded Git status</summary><pre>{git.status.replaceAll("\0", "\n")}</pre></details>}
  </>}</section>;
}


export function GitSnapshots({ call, homeDirectory }: { call: ToolCall; homeDirectory: string | undefined }) {
  return (
    <details className="git-details">
      <summary>Git snapshots</summary>
      <p className="detail-note">Captured before and after this tool call. These describe the repository at the time of each hook.</p>
      <div id="git-snapshots">
        <GitSnapshot record={call.pre} title="Before tool" homeDirectory={homeDirectory} />
        <GitSnapshot record={call.post} title="After tool" homeDirectory={homeDirectory} />
      </div>
    </details>
  );
}
