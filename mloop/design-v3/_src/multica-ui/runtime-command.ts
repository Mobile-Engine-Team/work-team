// Multica command-line parser; kept identical for the same form validation.
// Original license: ../../assets/multica/LICENSE
export type CommandLineParseError =
  | "empty"
  | "unclosed_quote"
  | "trailing_escape"
  | "shell_syntax"
  | "shell_expansion";

export type ParsedCommandLine =
  | { ok: true; commandName: string; fixedArgs: string[] }
  | { ok: false; error: CommandLineParseError };

const SHELL_CONTROL_CHARS = new Set(["|", ">", "<", ";", "&"]);

export function parseCommandLine(input: string): ParsedCommandLine {
  const line = input.trim();
  if (!line) return { ok: false, error: "empty" };

  const tokens: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let tokenStarted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? "";
    const next = line[i + 1] ?? "";

    if (quote == null && /\s/.test(ch)) {
      if (tokenStarted) {
        tokens.push(token);
        token = "";
        tokenStarted = false;
      }
      continue;
    }

    if (quote == null) {
      if (ch === "`" || ch === "$") {
        return {
          ok: false,
          error: ch === "$" ? "shell_expansion" : "shell_syntax",
        };
      }
      if (SHELL_CONTROL_CHARS.has(ch)) {
        return { ok: false, error: "shell_syntax" };
      }
      if (ch === "\\" && next) {
        token += next;
        tokenStarted = true;
        i += 1;
        continue;
      }
      if (ch === "\\") {
        return { ok: false, error: "trailing_escape" };
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        tokenStarted = true;
        continue;
      }
      token += ch;
      tokenStarted = true;
      continue;
    }

    if (ch === quote) {
      quote = null;
      tokenStarted = true;
      continue;
    }
    if (quote === '"' && ch === "\\" && next) {
      token += next;
      tokenStarted = true;
      i += 1;
      continue;
    }
    if (quote === '"' && ch === "\\") {
      return { ok: false, error: "trailing_escape" };
    }
    if (quote !== "'" && (ch === "`" || ch === "$")) {
      return {
        ok: false,
        error: ch === "$" ? "shell_expansion" : "shell_syntax",
      };
    }
    token += ch;
    tokenStarted = true;
  }

  if (quote != null) return { ok: false, error: "unclosed_quote" };
  if (tokenStarted) tokens.push(token);
  if (tokens.length === 0 || !tokens[0]?.trim()) {
    return { ok: false, error: "empty" };
  }

  return { ok: true, commandName: tokens[0], fixedArgs: tokens.slice(1) };
}

