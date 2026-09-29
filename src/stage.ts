/**
 * What every compile stage of the family says about the work it did, in one vocabulary: a status, an `ok`, an artifact and diagnostics. Stages are TOTAL — a stage
 * never refuses because an earlier one diagnosed — and each stage speaks only for itself; aggregating what they say is the orchestrator's job (a later phase).
 */
import type { ObixCompilerDiagnostic } from "./diagnostics.js";

/**
 * - `compiled`: the stage produced an artifact (there may still be diagnostics — the official compilers recover from many errors);
 * - `failed`: the stage reported an error or the official compiler threw, so there is no artifact;
 * - `absent`: the stage has nothing to compile: the file has no block of the kind it owns;
 * - `deferred`: valid syntax that the stage does not compile YET — a capability that is missing, not invalid input.
 */
export const OBIX_STAGE_STATUSES = Object.freeze(["compiled", "failed", "absent", "deferred"] as const);
export type ObixStageStatus = (typeof OBIX_STAGE_STATUSES)[number];

/**
 * The result of one stage. Two invariants hold for every stage (`checkStageResult` tests them): `ok` is true exactly when no diagnostic is an error — so a
 * `failed` or `deferred` result is never ok, and an `absent` one always is — and `artifact` is non-null exactly when the status is `compiled`.
 */
export interface ObixStageResult<TArtifact> {
  /** The file the stage worked on; every diagnostic of the result names it. */
  readonly filename: string;
  readonly status: ObixStageStatus;
  /** True when this stage succeeded: what it owns compiled with no error diagnostic, or there is nothing for it to compile. */
  readonly ok: boolean;
  /** Non-null exactly when `status` is `compiled`. */
  readonly artifact: TArtifact | null;
  /** This stage's diagnostics, frozen, in the order they were reported. */
  readonly diagnostics: readonly ObixCompilerDiagnostic[];
}
