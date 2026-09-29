/**
 * obix-compiler-diagnostics — the frontend-neutral diagnostic contract of the OBIX compiler family (Phase 4 prelude of the VueTS compiler recovery,
 * docs/recovery/vuets-compiler.md).
 *
 * One vocabulary for everything a compile stage reports: the diagnostic (`ObixCompilerDiagnostic`), the places it points at (`ObixSourcePosition`, `SourcePosition`,
 * `SourceRange`, `positionAt`), which text they index into (`ObixDiagnosticSpace`), what an upstream compiler said (`ObixUpstreamError`) and what a stage says about its
 * own work (`ObixStageStatus`, `ObixStageResult`) — with the two checks that say whether a value honours it.
 *
 * It depends on nothing. There is no Vue, no React, no DOM and no runtime here — the frontends (Vue today, React next) and every stage report IN this vocabulary; it does
 * not know them. The diagnostic CODES are not defined here: each stage owns its own namespace (`OBIX_SFC_…`, `OBIX_TEMPLATE_…`, …).
 */
export {
  OBIX_DIAGNOSTIC_CODE_PATTERN,
  OBIX_DIAGNOSTIC_SEVERITIES,
  OBIX_DIAGNOSTIC_SPACES,
  OBIX_UPSTREAM_ENUMS,
  OBIX_UPSTREAM_PACKAGES,
} from "./diagnostics.js";
export type {
  ObixCompilerDiagnostic,
  ObixDiagnosticSeverity,
  ObixDiagnosticSpace,
  ObixUpstreamEnum,
  ObixUpstreamError,
  ObixUpstreamPackage,
} from "./diagnostics.js";
export { positionAt } from "./positions.js";
export type { ObixSourcePosition, SourcePosition, SourceRange } from "./positions.js";
export { OBIX_STAGE_STATUSES } from "./stage.js";
export type { ObixStageResult, ObixStageStatus } from "./stage.js";
export { checkDiagnostic, checkStageResult, isObixCompilerDiagnostic } from "./check.js";
export type { ObixStageResultCheckOptions } from "./check.js";
