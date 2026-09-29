/**
 * The OBIX compiler diagnostic (directive, section 36): one shape for every stage, so that a parser error, a template error, a script error, a TypeScript error
 * and an unsupported-native-feature error can be told apart, located and aggregated by the orchestrator without translation.
 *
 * Positions are the official compiler's own: 1-based `line` and `column`, and the 0-based character `offset` from the start of the source.
 *
 * The types are moved here from the parser package (Phase 1 – 3) without a change of meaning; the tables are the runtime form of the closed sets the types name, so that a
 * check can be written against the same words the types use.
 */
import type { ObixSourcePosition } from "./positions.js";

export const OBIX_DIAGNOSTIC_SEVERITIES = Object.freeze(["error", "warning"] as const);
export type ObixDiagnosticSeverity = (typeof OBIX_DIAGNOSTIC_SEVERITIES)[number];

/**
 * Which text `start` and `end` index into: `"source"`, the SFC source, file-absolute (a diagnostic with no `space` says the same); or `"generated"`, the code the
 * reporting stage was GIVEN — the TypeScript phase works on generated code, and mapping such a place back to the file needs the source maps that compose the
 * stages, a deferred capability.
 */
export const OBIX_DIAGNOSTIC_SPACES = Object.freeze(["source", "generated"] as const);
export type ObixDiagnosticSpace = (typeof OBIX_DIAGNOSTIC_SPACES)[number];

/** The official package whose API reported an upstream diagnostic. */
export const OBIX_UPSTREAM_PACKAGES = Object.freeze(["@vue/compiler-sfc", "@vue/compiler-dom", "typescript"] as const);
export type ObixUpstreamPackage = (typeof OBIX_UPSTREAM_PACKAGES)[number];

/**
 * The upstream vocabulary a code belongs to: Vue's core enum, the DOM enum that extends it, a compat deprecation key, the reason codes of Babel's syntax errors
 * (reported through Vue's script compiler), or TypeScript's diagnostic table.
 */
export const OBIX_UPSTREAM_ENUMS = Object.freeze(["ErrorCodes", "DOMErrorCodes", "CompilerDeprecationTypes", "BabelParserReasonCodes", "TypeScriptDiagnostics"] as const);
export type ObixUpstreamEnum = (typeof OBIX_UPSTREAM_ENUMS)[number];

/**
 * What the official compiler said, exactly as it said it. It is METADATA: the OBIX `code` of a diagnostic never depends on it (D-50), so renumbering or
 * renaming an upstream enum cannot change an OBIX code. An error the official compiler reports as free text only has `enum`, `name` and `code` `null`.
 */
export interface ObixUpstreamError {
  readonly package: ObixUpstreamPackage;
  /** The version of the official compiler that reported it. */
  readonly version: string;
  readonly enum: ObixUpstreamEnum | null;
  /** The member of that enum (`X_MISSING_END_TAG`), or `null` when there is none. */
  readonly name: string | null;
  /** The raw upstream code: a number for Vue's enums and TypeScript's table, the key itself for a compat deprecation. */
  readonly code: number | string | null;
}

/**
 * A stable OBIX code: `OBIX`, the namespace of the stage (`SFC`, `TEMPLATE`, `SCRIPT`, `SCRIPT_SETUP`, `TYPESCRIPT`, and the stages to come) and one or more words —
 * upper-case letters and underscores only. There is no digit in it, so no number of an upstream compiler can be part of a code.
 */
export const OBIX_DIAGNOSTIC_CODE_PATTERN = /^OBIX_[A-Z]+_[A-Z]+(?:_[A-Z]+)*$/;

export interface ObixCompilerDiagnostic {
  /** A stable, OBIX-owned identifier (`OBIX_SFC_…`, `OBIX_TEMPLATE_…`, …). Never the raw message or a number of the underlying compiler. */
  readonly code: string;
  readonly message: string;
  readonly severity: ObixDiagnosticSeverity;
  readonly filename: string;
  readonly start?: ObixSourcePosition;
  readonly end?: ObixSourcePosition;
  /** Which text `start` and `end` index into. Absent, or `"source"`: the SFC source, file-absolute. `"generated"`: the code the reporting stage was given. */
  readonly space?: ObixDiagnosticSpace;
  /** What the official compiler said, when it is the one that said it; absent for diagnostics that are OBIX's own. */
  readonly upstream?: ObixUpstreamError;
  /**
   * The text of an exception behind the diagnostic, kept out of `message` when it depends on the build of the official compiler or carries the file name
   * (a code frame, an assertion message).
   */
  readonly detail?: string;
}
