import { Fragment } from "react";

export function MetadataFields({ values }: { values: [string, string][] }) {
  return values.map(([label, value]) => (
    <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>
  ));
}
