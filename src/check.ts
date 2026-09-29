/**
 * Does a value honour the contract? The two checks below answer with the LIST OF PROBLEMS — empty when it does — never with an exception: a stage that produced a
 * wrong diagnostic must be able to be told everything that is wrong with it at once.
 *
 * Each problem is `<member>: <what is wrong>`, the member addressed the way it is written (`start.line`, `upstream.package`, `diagnostics[2].code`). The problems come in the
 * order of the contract — its members first, then any member it does not have.
 */
import {
  OBIX_DIAGNOSTIC_CODE_PATTERN,
  OBIX_DIAGNOSTIC_SEVERITIES,
  OBIX_DIAGNOSTIC_SPACES,
  OBIX_UPSTREAM_ENUMS,
  OBIX_UPSTREAM_PACKAGES,
  type ObixCompilerDiagnostic,
} from "./diagnostics.js";
import { OBIX_STAGE_STATUSES } from "./stage.js";

type Record_ = Readonly<Record<string, unknown>>;

/** Plain data: an object whose prototype is `Object.prototype` or none — not an array, not a class instance, not a `Map`. */
function isRecord(value: unknown): value is Record_ {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isInteger = (value: unknown, minimum: number): boolean => typeof value === "number" && Number.isInteger(value) && value >= minimum;
const oneOf = (table: readonly string[]): string => table.join(", ");

/** A member the object may carry, absent or `undefined` alike. */
const present = (record: Record_, key: string): boolean => record[key] !== undefined;

/** The keys of `record` that the contract does not have, in their order. */
function unknownMembers(record: Record_, known: readonly string[], noun: string, prefix: string, out: string[]): void {
  for (const key of Object.keys(record)) if (!known.includes(key)) out.push(`${prefix}${key}: is not a member of ${noun}`);
}

const POSITION_MEMBERS = ["line", "column", "offset"];

/** The problems of one position; true when it has none, so the caller may compare it with another. */
function checkPosition(value: unknown, name: string, out: string[]): boolean {
  if (!isRecord(value)) {
    out.push(`${name}: must be a position (line, column, offset)`);
    return false;
  }
  const before = out.length;
  if (!isInteger(value.line, 1)) out.push(`${name}.line: must be an integer >= 1`);
  if (!isInteger(value.column, 1)) out.push(`${name}.column: must be an integer >= 1`);
  if (present(value, "offset") && !isInteger(value.offset, 0)) out.push(`${name}.offset: must be an integer >= 0`);
  unknownMembers(value, POSITION_MEMBERS, "a position", `${name}.`, out);
  return out.length === before;
}

/** True when `start` lies after `end`: by offset when both have one, else by line and column. */
function liesAfter(start: Record_, end: Record_): boolean {
  if (typeof start.offset === "number" && typeof end.offset === "number") return start.offset > end.offset;
  const startLine = start.line as number;
  const endLine = end.line as number;
  return startLine > endLine || (startLine === endLine && (start.column as number) > (end.column as number));
}

const UPSTREAM_MEMBERS = ["package", "version", "enum", "name", "code"];

function checkUpstream(value: unknown, out: string[]): void {
  if (!isRecord(value)) {
    out.push("upstream: must be an object");
    return;
  }
  for (const key of UPSTREAM_MEMBERS) if (!present(value, key)) out.push(`upstream.${key}: is required`);
  if (present(value, "package") && !OBIX_UPSTREAM_PACKAGES.includes(value.package as never)) out.push(`upstream.package: must be one of ${oneOf(OBIX_UPSTREAM_PACKAGES)}`);
  if (present(value, "version") && !isNonEmptyString(value.version)) out.push("upstream.version: must be a non-empty string");
  if (present(value, "enum") && value.enum !== null && !OBIX_UPSTREAM_ENUMS.includes(value.enum as never)) out.push(`upstream.enum: must be one of ${oneOf(OBIX_UPSTREAM_ENUMS)}, or null`);
  if (present(value, "name") && value.name !== null && typeof value.name !== "string") out.push("upstream.name: must be a string or null");
  if (present(value, "code") && value.code !== null && typeof value.code !== "string" && !(typeof value.code === "number" && Number.isFinite(value.code))) out.push("upstream.code: must be a number, a string or null");
  unknownMembers(value, UPSTREAM_MEMBERS, "upstream metadata", "upstream.", out);
}

const DIAGNOSTIC_MEMBERS = ["code", "message", "severity", "filename", "start", "end", "space", "upstream", "detail"];
const NOT_A_DIAGNOSTIC = "a diagnostic must be a plain object";

/** The problems of a diagnostic against the contract (`ObixCompilerDiagnostic`); `[]` when it honours it. */
export function checkDiagnostic(value: unknown): readonly string[] {
  if (!isRecord(value)) return [NOT_A_DIAGNOSTIC];
  const out: string[] = [];
  for (const key of ["code", "message", "severity", "filename"]) if (!present(value, key)) out.push(`${key}: is required`);
  if (present(value, "code") && !(typeof value.code === "string" && OBIX_DIAGNOSTIC_CODE_PATTERN.test(value.code))) {
    out.push("code: must be OBIX_<STAGE>_<WORD>… — upper-case words separated by underscores, no digit");
  }
  if (present(value, "message") && !isNonEmptyString(value.message)) out.push("message: must be a non-empty string");
  if (present(value, "severity") && !OBIX_DIAGNOSTIC_SEVERITIES.includes(value.severity as never)) out.push(`severity: must be one of ${oneOf(OBIX_DIAGNOSTIC_SEVERITIES)}`);
  if (present(value, "filename") && !isNonEmptyString(value.filename)) out.push("filename: must be a non-empty string");

  const hasStart = present(value, "start");
  const hasEnd = present(value, "end");
  if (hasStart !== hasEnd) out.push(`${hasStart ? "start" : "end"}: a place needs both start and end`);
  const startOk = hasStart ? checkPosition(value.start, "start", out) : false;
  const endOk = hasEnd ? checkPosition(value.end, "end", out) : false;
  if (startOk && endOk && liesAfter(value.start as Record_, value.end as Record_)) out.push("start: must not lie after end");

  if (present(value, "space")) {
    if (!OBIX_DIAGNOSTIC_SPACES.includes(value.space as never)) out.push(`space: must be one of ${oneOf(OBIX_DIAGNOSTIC_SPACES)}`);
    else if (!hasStart && !hasEnd) out.push("space: says which text start and end index into, so it needs a place");
  }
  if (present(value, "upstream")) checkUpstream(value.upstream, out);
  if (present(value, "detail") && typeof value.detail !== "string") out.push("detail: must be a string");
  unknownMembers(value, DIAGNOSTIC_MEMBERS, "a diagnostic", "", out);
  return out;
}

/** True when the value honours the contract: a type guard over `checkDiagnostic`. */
export function isObixCompilerDiagnostic(value: unknown): value is ObixCompilerDiagnostic {
  return checkDiagnostic(value).length === 0;
}

export interface ObixStageResultCheckOptions {
  /** The member that holds the artifact: `artifact` for most stages, `code` for the TypeScript phase, whose artifact is the JavaScript it produced. */
  readonly artifact?: string;
}

/** The problems of a stage result against the contract (`ObixStageResult`); `[]` when it honours it. */
export function checkStageResult(value: unknown, options: ObixStageResultCheckOptions = {}): readonly string[] {
  if (!isRecord(value)) return ["a stage result must be a plain object"];
  const artifactKey = options.artifact ?? "artifact";
  const out: string[] = [];
  for (const key of ["filename", "status", "ok", artifactKey, "diagnostics"]) if (value[key] === undefined) out.push(`${key}: is required`);
  if (present(value, "filename") && !isNonEmptyString(value.filename)) out.push("filename: must be a non-empty string");
  if (present(value, "status") && !OBIX_STAGE_STATUSES.includes(value.status as never)) out.push(`status: must be one of ${oneOf(OBIX_STAGE_STATUSES)}`);
  if (present(value, "ok") && typeof value.ok !== "boolean") out.push("ok: must be a boolean");

  let hasError = false;
  if (present(value, "diagnostics")) {
    if (!Array.isArray(value.diagnostics)) {
      out.push("diagnostics: must be an array");
    } else {
      value.diagnostics.forEach((entry: unknown, index) => {
        const at = `diagnostics[${index}]`;
        for (const problem of checkDiagnostic(entry)) out.push(problem === NOT_A_DIAGNOSTIC ? `${at}: ${problem}` : `${at}.${problem}`);
        if (isRecord(entry)) {
          if (entry.severity === "error") hasError = true;
          if (isNonEmptyString(entry.filename) && isNonEmptyString(value.filename) && entry.filename !== value.filename) {
            out.push(`${at}.filename: names ${entry.filename}, the result is about ${value.filename}`);
          }
        }
      });
      if (typeof value.ok === "boolean" && value.ok === hasError) out.push("ok: must be true exactly when no diagnostic is an error");
    }
  }
  if ((value.status === "failed" || value.status === "deferred") && value.ok === true) out.push("ok: a failed or deferred result is not ok");
  if (present(value, "status") && value[artifactKey] !== undefined) {
    if (value.status === "compiled" && value[artifactKey] === null) out.push(`${artifactKey}: a compiled result has one`);
    if (value.status !== "compiled" && value[artifactKey] !== null) out.push(`${artifactKey}: only a compiled result has one`);
  }
  unknownMembers(value, ["filename", "status", "ok", artifactKey, "diagnostics"], "a stage result", "", out);
  return out;
}
