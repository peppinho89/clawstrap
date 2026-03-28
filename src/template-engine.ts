import type { TemplateVars } from "./derive-vars.js";

const IF_BLOCK = /\{%#if\s+(\w+)%\}([\s\S]*?)\{%\/if%\}/g;
const UNLESS_BLOCK = /\{%#unless\s+(\w+)%\}([\s\S]*?)\{%\/unless%\}/g;
// Matches {%#if ...%} followed by another {%#if before hitting {%/if%}
const NESTED_IF = /\{%#if\s+\w+%\}(?:(?!\{%\/if%\})[\s\S])*?\{%#if\s+/;
const VARIABLE = /\{%(\w+)%\}/g;
const TRIPLE_BLANK = /\n{3,}/g;

export function render(template: string, vars: TemplateVars): string {
  let result = template;

  // 0. Detect nested {%#if%} blocks (not supported — would silently corrupt)
  if (NESTED_IF.test(result)) {
    throw new Error(
      "Nested {%#if%} blocks are not supported. Use {%#unless%} inside {%#if%} instead."
    );
  }

  // 1. Resolve {%#if condition%}...{%/if%} blocks
  result = result.replace(IF_BLOCK, (_, key: string, content: string) => {
    return vars[key] ? content : "";
  });

  // 2. Resolve {%#unless condition%}...{%/unless%} blocks
  result = result.replace(UNLESS_BLOCK, (_, key: string, content: string) => {
    return vars[key] ? "" : content;
  });

  // 3. Replace all remaining {%variable%} tokens
  result = result.replace(VARIABLE, (match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`Template variable not found: ${key}`);
    }
    return String(value);
  });

  // 4. Collapse triple+ blank lines to double
  result = result.replace(TRIPLE_BLANK, "\n\n");

  return result;
}
