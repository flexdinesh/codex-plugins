import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/client/styles.css", import.meta.url), "utf8");

test("typography uses rem size tokens and scalable tracking", () => {
  const tokenValues = [...css.matchAll(/--font-size-[\w-]+:\s*([^;]+);/g)].map((match) => match[1]);
  assert.ok(tokenValues.length >= 10);
  assert.ok(tokenValues.every((value) => value?.endsWith("rem")));
  assert.deepEqual(
    tokenValues.filter((value) => Number.parseFloat(value ?? "0") < 1),
    ["0.75rem", "0.875rem"],
  );
  assert.match(css, /--font-size-base:\s*1rem;/);

  const declarations = css.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("font-size:"))
    .map((line) => line.slice("font-size:".length, -1).trim());
  assert.ok(
    declarations.every((value) => value === "81.25%" || value.startsWith("var(--font-size-")),
    `untokenized font sizes: ${declarations.filter((value) => value !== "81.25%" && !value.startsWith("var(--font-size-")).join(", ")}`,
  );
  assert.doesNotMatch(css, /(?:font|font-size|letter-spacing):[^;]*\dpx/);
  assert.match(css, /body\s*{[^}]*font-size:\s*var\(--font-size-base\)/s);
});
