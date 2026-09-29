# obix-compiler-diagnostics

> Previous name: `@obinexusltd/obix-compiler-diagnostics` — OBIX packages are named without an npm scope since decision D-102 (2026-09-29); the package, its version and its exports are unchanged.

**The frontend-neutral diagnostic contract of the OBIX compiler family.** One vocabulary for everything a compile stage reports — the same for the Vue frontend today and the React frontend next — and the checks that say whether a value honours it. It depends on **nothing**: no Vue, no React, no DOM, no runtime, not even another OBIX package.

```bash
npm install obix-compiler-diagnostics
```

```text
   every stage reports IN this vocabulary            it knows none of them
   parser · sfc · template · script · script-setup · typescript · (dop · validator · emit …)
                         │
                         ▼
   obix-compiler-diagnostics     ObixCompilerDiagnostic · positions · spaces · upstream · stage result
```

```ts
import { positionAt, checkDiagnostic, checkStageResult } from "obix-compiler-diagnostics";
import type { ObixCompilerDiagnostic, ObixStageResult, SourceRange } from "obix-compiler-diagnostics";

positionAt("ab\ncd", 4);                       // { line: 2, column: 2, offset: 4 }  — frozen; 1-based line and column, 0-based offset
checkDiagnostic(diagnostic);                   // [] — or one line per problem: "start.line: must be an integer >= 1"
checkStageResult(result);                      // [] — or "ok: must be true exactly when no diagnostic is an error"
checkStageResult({ … code … }, { artifact: "code" });   // the TypeScript phase's artifact is the code it produced
```

## What it owns

| Export | Role |
|---|---|
| `ObixCompilerDiagnostic` | `{ code, message, severity, filename, start?, end?, space?, upstream?, detail? }` — where, what and how bad, in OBIX words. `code` is OBIX-owned (`OBIX_<STAGE>_<WORDS>`, no digit); what an upstream compiler said is *metadata* (`upstream`), never part of the code (D-50) |
| `ObixSourcePosition`, `SourcePosition`, `SourceRange`, `positionAt` | positions in the official convention — 1-based `line` and `column`, 0-based `offset`; `positionAt` clamps into the text and counts a CRLF pair as one line break |
| `ObixDiagnosticSpace` | `"source"` (the SFC, file-absolute; also what an absent `space` means) or `"generated"` (the code the stage was *given* — the TypeScript phase works on generated code) |
| `ObixUpstreamError`, `ObixUpstreamPackage`, `ObixUpstreamEnum` | what the official compiler said, exactly as it said it: package, version, enum, member name, raw code |
| `ObixStageStatus`, `ObixStageResult<TArtifact>` | what a stage says about its own work: `compiled` · `failed` · `absent` · `deferred`, an `ok`, an artifact (non-null exactly when `compiled`) and its diagnostics. Stages are **total**: none refuses because an earlier one diagnosed |
| `OBIX_DIAGNOSTIC_SEVERITIES`, `_SPACES`, `OBIX_UPSTREAM_PACKAGES`, `_ENUMS`, `OBIX_STAGE_STATUSES`, `OBIX_DIAGNOSTIC_CODE_PATTERN` | the closed sets the types name, as frozen tables, so a check speaks the same words |
| `checkDiagnostic`, `isObixCompilerDiagnostic`, `checkStageResult` | the list of problems of a value against the contract — never an exception, every problem at once, each as `<member>: <what is wrong>` |

The **codes** are not defined here: each stage owns its namespace (`OBIX_SFC_…` in the parser, `OBIX_TEMPLATE_…`, `OBIX_SCRIPT_…`, `OBIX_SCRIPT_SETUP_…`, `OBIX_TYPESCRIPT_…`, and `OBIX_DOP_…` from the DOP lowering).

## Two invariants of every stage result

`checkStageResult` tests them; every stage of the family keeps them (the 819 stage results of the corpus golden all pass):

1. **`ok` is true exactly when no diagnostic is an error** — so a `failed` or `deferred` result is never ok and an `absent` one always is; warnings do not make a compiled unit not ok.
2. **`artifact` is non-null exactly when the status is `compiled`.**

## The move (Phase 4 prelude)

`ObixCompilerDiagnostic`, `ObixSourcePosition`, `positionAt`, the upstream metadata and the severity type lived in `obix-compiler-parser` (Phase 1 – 3), and `SourcePosition` / `SourceRange` in `obix-compiler-sfc`. They moved here **without changing what any stage reports**: `tests/vuets/golden/diagnostics.json` is every diagnostic of every stage for the 120-fixture corpus in both syntaxes (245 entries, 188 diagnostics), generated from the build *before* the move, and the packages after it reproduce it byte for byte — key order and freezing included (`npm run test:vuets`). The parser and the SFC package no longer re-export what they moved: one owner, one import path.

## Design notes

- **Zero dependencies is a gate, not a promise.** `obix-neutral.json` lists this package as a *neutral contract*: graph rule R9 refuses any dependency of any kind (dev included), refuses anything it reaches that declares a third-party dependency, and the Node-free import check applies to it although it lives in the compiler family, which that check otherwise exempts (`npm run check:graph`, `npm run check:purity`).
- **Runtime surface, small on purpose.** The types are erased; what ships as JavaScript is `positionAt`, six frozen tables, one pattern and three checks — about 170 lines of JavaScript that import nothing but their own modules.
- **Frozen where it is data.** `positionAt` returns a frozen position; the stages freeze their diagnostics all the way down (the golden pins it).

## Tests

`npm test -w obix-compiler-diagnostics` — 20 tests: 15 written before the code (five more came from mutation testing, which found seven changes of the built checks that none of the fifteen noticed — an array without a prototype taken for a record, a position with a problem compared with the other, a place ordered by line and column, a NaN code, a missing `ok`, the place of a diagnostic that is not a record): the surface and the tables, the code pattern, zero dependencies (manifest, built imports, no host or browser global), `positionAt` against an independent re-derivation for every offset of sources with LF, CRLF, lone CR and astral characters, `checkDiagnostic` on all 188 diagnostics of the golden and on 44 ways to be wrong, `checkStageResult` on all 819 stage results and on 18 ways to be wrong, and the declared types judged by TypeScript itself (`@ts-expect-error` for every wrong shape).

<!-- obix-release:begin — generated by scripts/release/prepare.mjs; edit the text above this line -->

## Installation

```bash
npm install obix-compiler-diagnostics
```

## API surface

- `obix-compiler-diagnostics` — 10 value exports: `OBIX_DIAGNOSTIC_CODE_PATTERN`, `OBIX_DIAGNOSTIC_SEVERITIES`, `OBIX_DIAGNOSTIC_SPACES`, `OBIX_STAGE_STATUSES`, `OBIX_UPSTREAM_ENUMS`, `OBIX_UPSTREAM_PACKAGES`, `checkDiagnostic`, `checkStageResult`, `isObixCompilerDiagnostic`, `positionAt`
- Type declarations: `./dist/index.d.ts` (and a declaration next to every JS entry point).

## Architecture role

`obix-compiler-diagnostics` is part of the **OBIX compiler** (build-time tooling): it never runs in an application's browser graph.

The architecture of OBIX — the package families and which packages are public API — is indexed in the umbrella: [docs/architecture.md](https://github.com/obinexus/obix/blob/main/docs/architecture.md).

## Package relationships

- Depends on (OBIX): no other OBIX package.
- Used by (OBIX): [`obix-compiler-dop`](https://github.com/obinexus/obix-compiler-dop), [`obix-compiler-ir`](https://github.com/obinexus/obix-compiler-ir), [`obix-compiler-parser`](https://github.com/obinexus/obix-compiler-parser), [`obix-compiler-react`](https://github.com/obinexus/obix-compiler-react), [`obix-compiler-script`](https://github.com/obinexus/obix-compiler-script), [`obix-compiler-sfc`](https://github.com/obinexus/obix-compiler-sfc), [`obix-compiler-template`](https://github.com/obinexus/obix-compiler-template), [`obix-compiler-typescript`](https://github.com/obinexus/obix-compiler-typescript).

## Testing

- 1 test file ships in the npm package (`test/`): the evidence of the package's contract, published so that its verification can be inspected — not runtime code (no entry point reaches it).
- **Standalone**: none.
- **Need the OBIX development / test harness**: 1 — it reads the OBIX monorepo's shared harness, oracles or fixtures, so it does **not** run from an npm install or from this package's repository alone; it is shipped for inspection and provenance:
  - `test/diagnostics.test.mjs` — reads ../../../tests/vuets/type-check.mjs, outside the package
- Run them with `npm test` (`node --test "test/*.test.mjs"`) in the OBIX monorepo, which provides the test tooling (Node's test runner, TypeScript) and the harness.

## Documentation

- [CHANGELOG.md](CHANGELOG.md)
- The OBIX architecture index: [obix/docs/architecture.md](https://github.com/obinexus/obix/blob/main/docs/architecture.md)

## Repository

- https://github.com/obinexus/obix-compiler-diagnostics — `git@github.com:obinexus/obix-compiler-diagnostics.git`
- Issues: https://github.com/obinexus/obix-compiler-diagnostics/issues
- The repository is a clean export of the package from the OBIX monorepo. Its lineage — the sources it was recovered from and its earlier names — is `PROVENANCE.json`, shipped in this package; the repository's copy also records the monorepo commit it was exported from.

## License

MIT — see [LICENSE](LICENSE).

<!-- obix-release:end -->
