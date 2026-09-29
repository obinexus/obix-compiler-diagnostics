/**
 * obix-compiler-diagnostics — the frontend-neutral diagnostic contract (Phase 4 prelude of the VueTS compiler recovery, docs/recovery/vuets-compiler.md).
 *
 * The contract MOVED here from the parser (and `SourcePosition` / `SourceRange` from the SFC package) without a change of meaning: what every stage reports is
 * byte-identical to the golden of tests/vuets (diagnostics-golden.test.mjs). These tests hold the package itself to what it promises: it has no dependency and no
 * import of any kind, `positionAt` is the official position of an offset, the validators accept exactly what the stages produce — every one of the 188 diagnostics of
 * the golden — and refuse each way a diagnostic or a stage result can be wrong, and the declared types accept what they should and reject what they should.
 *
 * Written before the implementation (RED), then satisfied (GREEN).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as contract from '../dist/index.js';
import { typeErrors } from '../../../tests/vuets/type-check.mjs';

const PACKAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = JSON.parse(fs.readFileSync(path.join(PACKAGE, '..', '..', 'tests', 'vuets', 'golden', 'diagnostics.json'), 'utf8'));
const { checkDiagnostic, checkStageResult, isObixCompilerDiagnostic, positionAt } = contract;

const position = (line, column, offset) => ({ line, column, offset });
/** The smallest valid diagnostic, and a fully populated one: every member the contract has. */
const minimal = () => ({ code: 'OBIX_SFC_EMPTY_FILE', message: 'The file is empty.', severity: 'error', filename: 'Counter.obix' });
const full = () => ({
  code: 'OBIX_TYPESCRIPT_SYNTAX_INVALID',
  message: 'Expression expected.',
  severity: 'error',
  filename: 'Counter.obix',
  start: position(2, 17, 28),
  end: position(2, 18, 29),
  space: 'generated',
  upstream: { package: 'typescript', version: '6.0.3', enum: 'TypeScriptDiagnostics', name: null, code: 1109 },
  detail: 'thrown text',
});
const problems = (mutate, base = full) => {
  const d = base();
  mutate(d);
  return checkDiagnostic(d);
};

// ── the surface ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the package exposes the position function, the constant tables and the checks — and nothing else', () => {
  assert.deepEqual(Object.keys(contract).sort(), [
    'OBIX_DIAGNOSTIC_CODE_PATTERN', 'OBIX_DIAGNOSTIC_SEVERITIES', 'OBIX_DIAGNOSTIC_SPACES', 'OBIX_STAGE_STATUSES', 'OBIX_UPSTREAM_ENUMS', 'OBIX_UPSTREAM_PACKAGES',
    'checkDiagnostic', 'checkStageResult', 'isObixCompilerDiagnostic', 'positionAt',
  ]);
});

test('the constant tables are frozen and say exactly what the contract says: two severities, two spaces, four stage statuses, the closed upstream vocabulary', () => {
  assert.deepEqual([...contract.OBIX_DIAGNOSTIC_SEVERITIES], ['error', 'warning']);
  assert.deepEqual([...contract.OBIX_DIAGNOSTIC_SPACES], ['source', 'generated']);
  assert.deepEqual([...contract.OBIX_STAGE_STATUSES], ['compiled', 'failed', 'absent', 'deferred']);
  assert.deepEqual([...contract.OBIX_UPSTREAM_PACKAGES], ['@vue/compiler-sfc', '@vue/compiler-dom', 'typescript']);
  assert.deepEqual([...contract.OBIX_UPSTREAM_ENUMS], ['ErrorCodes', 'DOMErrorCodes', 'CompilerDeprecationTypes', 'BabelParserReasonCodes', 'TypeScriptDiagnostics']);
  for (const table of [contract.OBIX_DIAGNOSTIC_SEVERITIES, contract.OBIX_DIAGNOSTIC_SPACES, contract.OBIX_STAGE_STATUSES, contract.OBIX_UPSTREAM_PACKAGES, contract.OBIX_UPSTREAM_ENUMS]) assert.ok(Object.isFrozen(table));
});

test('the code pattern: OBIX, a stage namespace and at least one word — upper-case letters and underscores, never a digit, so no number of an upstream compiler can be in a code', () => {
  const pattern = contract.OBIX_DIAGNOSTIC_CODE_PATTERN;
  for (const ok of ['OBIX_SFC_EMPTY', 'OBIX_TEMPLATE_V_IF_EXPRESSION_MISSING', 'OBIX_SCRIPT_SETUP_DEFINE_PROPS_DUPLICATE', 'OBIX_TYPESCRIPT_SYNTAX_INVALID']) assert.match(ok, pattern, ok);
  for (const bad of ['', 'OBIX', 'OBIX_SFC', 'OBIX__SFC_EMPTY', 'OBIX_SFC_', 'OBIX_SFC_EMPTY_', 'obix_sfc_empty', 'OBIX_sfc_empty', 'SFC_EMPTY_FILE', 'OBIX_SFC_ERROR_2', 'OBIX_SFC_X2_EMPTY', 'OBIX-SFC-EMPTY', ' OBIX_SFC_EMPTY', 'OBIX_SFC_EMPTY\n']) assert.doesNotMatch(bad, pattern, JSON.stringify(bad));
});

// ── zero dependencies ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('zero dependencies (ruling 2 of Phase 4): no dependency field of any kind, no import of anything but its own modules, no host or browser global — Vue, React, the DOM and any runtime are unreachable from here', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE, 'package.json'), 'utf8'));
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies', 'bundleDependencies', 'bundledDependencies']) {
    assert.equal(manifest[field], undefined, `${field} must not be declared`);
  }
  const files = fs.readdirSync(path.join(PACKAGE, 'dist'), { recursive: true }).map(String).filter((f) => f.endsWith('.js'));
  assert.ok(files.length >= 5, `${files.length} built modules`);
  let imports = 0;
  for (const file of files) {
    const code = fs.readFileSync(path.join(PACKAGE, 'dist', file), 'utf8');
    const uncommented = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of uncommented.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g)) {
      assert.match(m[1], /^\.\/[a-z]+\.js$/, `${file}: imports ${m[1]} — only a module of this package is allowed`);
      imports++;
    }
    assert.doesNotMatch(uncommented, /\brequire\s*\(|\bimport\s*\(|\bprocess\b|\bBuffer\b|\bwindow\b|\bdocument\b|\bself\b|\bglobalThis\b|node:/, `${file}: no host, browser or loader global`);
  }
  assert.ok(imports >= 3, `${imports} intra-package imports were seen — the scan reads the built code`);
});

// ── positionAt ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The position of an offset re-derived independently: count the line feeds before it. */
const reference = (source, offset) => {
  const at = Math.min(Math.max(offset, 0), source.length);
  const before = source.slice(0, at);
  return { line: before.split('\n').length, column: at - (before.lastIndexOf('\n') + 1) + 1, offset: at };
};

test('positionAt: the official convention — 1-based line and column, 0-based offset — for every offset of sources with LF, CRLF, lone CR, blank lines and astral characters', () => {
  const sources = ['', 'a', 'ab\ncd', 'a\r\nb\r\n', '\n\n\n', 'x\ry', 'é😀\nz', '<template>\n  <p>{{ n }}</p>\n</template>\n'];
  let checked = 0;
  for (const source of sources) {
    for (let offset = 0; offset <= source.length; offset++) {
      assert.deepEqual({ ...positionAt(source, offset) }, reference(source, offset), `${JSON.stringify(source)} @ ${offset}`);
      checked++;
    }
  }
  assert.ok(checked > 60, `${checked} positions`);
});

test('positionAt: a line ends at LF alone (a CRLF pair is one line break and the CR belongs to the line it ends), the offset is clamped into the source, and the result is frozen data', () => {
  assert.deepEqual({ ...positionAt('ab\ncd', 2) }, { line: 1, column: 3, offset: 2 }, 'the newline itself is the last column of its line');
  assert.deepEqual({ ...positionAt('ab\r\ncd', 4) }, { line: 2, column: 1, offset: 4 }, 'CRLF: the pair is one line break');
  assert.deepEqual({ ...positionAt('ab\r\ncd', 3) }, { line: 1, column: 4, offset: 3 }, 'the LF of a pair is the last column of its line');
  assert.deepEqual({ ...positionAt('ab\ncd', 99) }, { line: 2, column: 3, offset: 5 }, 'clamped above');
  assert.deepEqual({ ...positionAt('ab\ncd', -4) }, { line: 1, column: 1, offset: 0 }, 'clamped below');
  assert.deepEqual({ ...positionAt('', 0) }, { line: 1, column: 1, offset: 0 }, 'an empty source');
  assert.deepEqual(Object.keys(positionAt('x', 0)), ['line', 'column', 'offset'], 'the key order of a position');
  assert.ok(Object.isFrozen(positionAt('x', 0)));
});

// ── checkDiagnostic ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('checkDiagnostic accepts the smallest diagnostic, a fully populated one, and every optional member on its own', () => {
  assert.deepEqual(checkDiagnostic(minimal()), []);
  assert.deepEqual(checkDiagnostic(full()), []);
  assert.deepEqual(checkDiagnostic({ ...minimal(), severity: 'warning' }), []);
  assert.deepEqual(checkDiagnostic({ ...minimal(), start: position(1, 1, 0), end: position(1, 1, 0) }), [], 'an empty range is a place');
  assert.deepEqual(checkDiagnostic({ ...minimal(), start: { line: 3, column: 4 }, end: { line: 3, column: 9 } }), [], 'the offset of a position is optional');
  assert.deepEqual(checkDiagnostic({ ...minimal(), start: position(1, 1, 0), end: position(1, 2, 1), space: 'source' }), []);
  assert.deepEqual(checkDiagnostic({ ...minimal(), upstream: { package: '@vue/compiler-dom', version: '3.5.43', enum: 'CompilerDeprecationTypes', name: 'COMPILER_IS_ON_ELEMENT', code: 'COMPILER_IS_ON_ELEMENT' } }), [], 'a compat key is a string code');
  assert.deepEqual(checkDiagnostic({ ...minimal(), upstream: { package: '@vue/compiler-sfc', version: '3.5.43', enum: null, name: null, code: null } }), [], 'free text from upstream: no enum, no name, no code');
  assert.deepEqual(checkDiagnostic({ ...minimal(), detail: '' }), [], 'an empty detail is still a string');
  assert.ok(isObixCompilerDiagnostic(full()) && isObixCompilerDiagnostic(minimal()));
  assert.deepEqual(checkDiagnostic(Object.freeze({ ...minimal(), start: Object.freeze(position(1, 1, 0)), end: Object.freeze(position(1, 1, 0)) })), [], 'frozen input is what the stages produce');
  assert.deepEqual(checkDiagnostic(Object.assign(Object.create(null), minimal())), [], 'a null-prototype record is plain data too');
});

test('checkDiagnostic accepts EVERY diagnostic every stage reports for the whole corpus in both syntaxes — the 188 of the golden — and says nothing about them', () => {
  let checked = 0;
  for (const [key, entry] of Object.entries(GOLDEN)) {
    for (const [stage, record] of Object.entries(entry)) {
      if (!record) continue;
      for (const d of record.diagnostics) {
        assert.deepEqual(checkDiagnostic(d), [], `${key} · ${stage} · ${d.code}`);
        assert.ok(isObixCompilerDiagnostic(d));
        checked++;
      }
    }
  }
  assert.equal(checked, 188);
});

test('checkDiagnostic names each way a diagnostic can be wrong, with the member it is about', () => {
  const cases = [
    // [what is done to a full diagnostic, what must be said]
    [(d) => { delete d.code; }, /^code: is required/],
    [(d) => { delete d.message; }, /^message: is required/],
    [(d) => { delete d.severity; }, /^severity: is required/],
    [(d) => { delete d.filename; }, /^filename: is required/],
    [(d) => { d.code = 'sfc_empty'; }, /^code: must be OBIX/],
    [(d) => { d.code = 'OBIX_SFC_ERROR_44'; }, /^code: must be OBIX/],
    [(d) => { d.code = 'OBIX_SFC'; }, /^code: must be OBIX/],
    [(d) => { d.code = 12; }, /^code: must be OBIX/],
    [(d) => { d.message = ''; }, /^message: must be a non-empty string/],
    [(d) => { d.message = 7; }, /^message: must be a non-empty string/],
    [(d) => { d.severity = 'info'; }, /^severity: must be one of error, warning/],
    [(d) => { d.severity = 'ERROR'; }, /^severity: must be one of error, warning/],
    [(d) => { d.filename = ''; }, /^filename: must be a non-empty string/],
    [(d) => { d.filename = null; }, /^filename: must be a non-empty string/],
    [(d) => { delete d.end; }, /^start: a place needs both start and end/],
    [(d) => { delete d.start; }, /^end: a place needs both start and end/],
    [(d) => { d.start = 5; }, /^start: must be a position/],
    [(d) => { d.start = null; }, /^start: must be a position/],
    [(d) => { d.start = position(0, 1, 0); }, /^start\.line: must be an integer >= 1/],
    [(d) => { d.start = position(1.5, 1, 0); }, /^start\.line: must be an integer >= 1/],
    [(d) => { d.start = position(1, 0, 0); }, /^start\.column: must be an integer >= 1/],
    [(d) => { d.start = position(1, '1', 0); }, /^start\.column: must be an integer >= 1/],
    [(d) => { d.start = position(1, 1, -1); d.end = position(1, 1, 0); }, /^start\.offset: must be an integer >= 0/],
    [(d) => { d.start = position(1, 1, 0.5); }, /^start\.offset: must be an integer >= 0/],
    [(d) => { d.start = { line: 1, column: 1, offset: 0, extra: 1 }; }, /^start\.extra: is not a member of a position/],
    [(d) => { d.end = position(2, 0, 29); }, /^end\.column: must be an integer >= 1/],
    [(d) => { d.start = position(1, 1, 30); d.end = position(1, 2, 29); }, /^start: must not lie after end/],
    [(d) => { d.space = 'mapped'; }, /^space: must be one of source, generated/],
    [(d) => { d.space = true; }, /^space: must be one of source, generated/],
    [(d) => { delete d.start; delete d.end; }, /^space: says which text start and end index into, so it needs a place/],
    [(d) => { d.upstream = 'typescript'; }, /^upstream: must be an object/],
    [(d) => { d.upstream = null; }, /^upstream: must be an object/],
    [(d) => { d.upstream.package = 'react'; }, /^upstream\.package: must be one of @vue\/compiler-sfc, @vue\/compiler-dom, typescript/],
    [(d) => { d.upstream.version = ''; }, /^upstream\.version: must be a non-empty string/],
    [(d) => { d.upstream.enum = 'Enum'; }, /^upstream\.enum: must be one of ErrorCodes, DOMErrorCodes, CompilerDeprecationTypes, BabelParserReasonCodes, TypeScriptDiagnostics, or null/],
    [(d) => { d.upstream.name = 4; }, /^upstream\.name: must be a string or null/],
    [(d) => { d.upstream.code = true; }, /^upstream\.code: must be a number, a string or null/],
    [(d) => { d.upstream.code = undefined; }, /^upstream\.code: is required/],
    [(d) => { delete d.upstream.name; }, /^upstream\.name: is required/],
    [(d) => { d.upstream.extra = 1; }, /^upstream\.extra: is not a member of upstream metadata/],
    [(d) => { d.detail = 1; }, /^detail: must be a string/],
    [(d) => { d.detail = null; }, /^detail: must be a string/],
    [(d) => { d.notes = []; }, /^notes: is not a member of a diagnostic/],
    [(d) => { d.line = 3; }, /^line: is not a member of a diagnostic/],
  ];
  for (const [mutate, expected] of cases) {
    const got = problems(mutate);
    assert.equal(got.length, 1, `${mutate}: ${JSON.stringify(got)}`);
    assert.match(got[0], expected, String(mutate));
  }
});

test('checkDiagnostic reports every problem of a diagnostic, not the first, in the order of the contract', () => {
  const got = checkDiagnostic({ code: 'nope', message: '', severity: 'fatal', filename: '', extra: true });
  assert.deepEqual(got.map((p) => p.split(':')[0]), ['code', 'message', 'severity', 'filename', 'extra']);
});

test('checkDiagnostic refuses what is not a plain record: null, a primitive, an array, a function, a class instance, a Map', () => {
  class Diagnostic { constructor() { Object.assign(this, minimal()); } }
  for (const value of [null, undefined, 3, 'OBIX_SFC_EMPTY', true, [], [minimal()], () => minimal(), new Diagnostic(), new Map()]) {
    assert.deepEqual(checkDiagnostic(value), ['a diagnostic must be a plain object'], String(value));
    assert.equal(isObixCompilerDiagnostic(value), false);
  }
  assert.equal(isObixCompilerDiagnostic({ ...minimal(), severity: 'x' }), false);
});

// ── checkStageResult ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const result = (over = {}) => ({ filename: 'Counter.obix', status: 'compiled', ok: true, artifact: { any: 'thing' }, diagnostics: [], ...over });
const diagnostic = (over = {}) => ({ ...minimal(), ...over });

test('checkStageResult accepts every kind of result the stages produce: compiled with or without warnings, compiled with errors, failed, deferred, absent — and one whose artifact is the code', () => {
  assert.deepEqual(checkStageResult(result()), []);
  assert.deepEqual(checkStageResult(result({ diagnostics: [diagnostic({ severity: 'warning' })] })), [], 'warnings do not make a compiled unit not ok');
  assert.deepEqual(checkStageResult(result({ ok: false, diagnostics: [diagnostic()] })), [], 'Vue recovers from most template errors: compiled, with errors, not ok');
  assert.deepEqual(checkStageResult(result({ status: 'failed', ok: false, artifact: null, diagnostics: [diagnostic()] })), []);
  assert.deepEqual(checkStageResult(result({ status: 'deferred', ok: false, artifact: null, diagnostics: [diagnostic()] })), []);
  assert.deepEqual(checkStageResult(result({ status: 'absent', ok: true, artifact: null })), []);
  assert.deepEqual(checkStageResult({ filename: 'A.obix', status: 'compiled', ok: true, code: 'export {}', diagnostics: [] }, { artifact: 'code' }), []);
  assert.deepEqual(checkStageResult({ filename: 'A.obix', status: 'failed', ok: false, code: null, diagnostics: [diagnostic({ filename: 'A.obix' })] }, { artifact: 'code' }), []);
});

test('checkStageResult accepts every stage record of the golden — 819 results: script 240, TypeScript on the script 108, template 240, TypeScript on the render code 226, five probes', () => {
  let checked = 0;
  for (const [key, entry] of Object.entries(GOLDEN)) {
    for (const [stage, record] of Object.entries(entry)) {
      if (!record || record.status === undefined) continue;
      const filename = record.diagnostics[0]?.filename ?? 'X.obix';
      const rebuilt = { filename, status: record.status, ok: record.ok, artifact: record.status === 'compiled' ? {} : null, diagnostics: record.diagnostics };
      assert.deepEqual(checkStageResult(rebuilt), [], `${key} · ${stage}`);
      checked++;
    }
  }
  assert.equal(checked, 819);
});

test('checkStageResult names each way a result can be wrong: an unknown status, an ok that disagrees with the diagnostics, an artifact where there is none or none where there is one, a foreign diagnostic', () => {
  const cases = [
    [result({ status: 'done' }), /^status: must be one of compiled, failed, absent, deferred/],
    [result({ ok: 'yes' }), /^ok: must be a boolean/],
    [result({ ok: false }), /^ok: must be true exactly when no diagnostic is an error/],
    [result({ ok: true, diagnostics: [diagnostic()] }), /^ok: must be true exactly when no diagnostic is an error/],
    [result({ status: 'failed', ok: true, artifact: null }), /^ok: a failed or deferred result is not ok/],
    [result({ status: 'deferred', ok: true, artifact: null }), /^ok: a failed or deferred result is not ok/],
    [result({ status: 'failed', ok: false, artifact: null, diagnostics: [diagnostic({ severity: 'warning' })] }), /^ok: must be true exactly when no diagnostic is an error/],
    [result({ artifact: null }), /^artifact: a compiled result has one/],
    [result({ status: 'failed', ok: false, diagnostics: [diagnostic()] }), /^artifact: only a compiled result has one/],
    [result({ status: 'absent', artifact: {} }), /^artifact: only a compiled result has one/],
    [result({ diagnostics: 'none' }), /^diagnostics: must be an array/],
    [result({ diagnostics: [diagnostic({ code: 'x' })], ok: false }), /^diagnostics\[0\]\.code: must be OBIX/],
    [result({ ok: false, diagnostics: [diagnostic({ filename: 'Other.obix' })] }), /^diagnostics\[0\]\.filename: names Other\.obix, the result is about Counter\.obix/],
    [result({ filename: '' }), /^filename: must be a non-empty string/],
    [result({ extra: 1 }), /^extra: is not a member of a stage result/],
    [(() => { const r = result(); delete r.artifact; return r; })(), /^artifact: is required/],
    [null, /^a stage result must be a plain object/],
    [[], /^a stage result must be a plain object/],
  ];
  for (const [value, expected] of cases) {
    const got = checkStageResult(value);
    assert.ok(got.length >= 1, JSON.stringify(value));
    assert.ok(got.some((p) => expected.test(p)), `${JSON.stringify(value)} → ${JSON.stringify(got)}`);
  }
});

// ── what mutation testing asked for ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (docs/recovery/vuets-compiler.md, Phase 4: seven changes of the built code that no test above noticed. Each test below fails against the change it is named for.)

test('an array is never a record — not even one without a prototype, which the prototype test alone would let through', () => {
  const bare = Object.setPrototypeOf([], null);
  assert.deepEqual(checkDiagnostic(bare), ['a diagnostic must be a plain object']);
  assert.deepEqual(checkStageResult(bare), ['a stage result must be a plain object']);
});

test('a position that is wrong in itself is not also compared with the other one: a problem is said once', () => {
  const later = (d) => { d.start = position(5, 0, 40); d.end = position(1, 1, 3); };
  assert.deepEqual(problems(later), ['start.column: must be an integer >= 1']);
  const earlier = (d) => { d.start = position(1, 1, 3); d.end = position(5, 0, 40); };
  assert.deepEqual(problems(earlier), ['end.column: must be an integer >= 1']);
});

test('a place without offsets is ordered by line, then by column: the same place is in order, an earlier line or column for the end is not', () => {
  const place = (start, end) => problems((d) => { d.start = start; d.end = end; });
  const at = (line, column) => ({ line, column });
  assert.deepEqual(place(at(1, 3), at(1, 3)), [], 'one point');
  assert.deepEqual(place(at(1, 3), at(1, 5)), [], 'later column');
  assert.deepEqual(place(at(1, 9), at(2, 1)), [], 'later line, earlier column');
  assert.deepEqual(place(at(2, 1), at(1, 9)), ['start: must not lie after end'], 'earlier line');
  assert.deepEqual(place(at(1, 5), at(1, 3)), ['start: must not lie after end'], 'earlier column');
  assert.deepEqual(place({ ...at(1, 1), offset: 4 }, { ...at(1, 1), offset: 4 }), [], 'equal offsets are one point too');
});

test('a numeric upstream code is a finite number: NaN and Infinity are not codes, and zero and a negative number are', () => {
  for (const code of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) assert.match(problems((d) => { d.upstream.code = code; })[0], /^upstream\.code: must be a number, a string or null/, String(code));
  for (const code of [0, -1, 1109, 'TS1109', null]) assert.deepEqual(problems((d) => { d.upstream.code = code; }), [], String(code));
});

test('a stage result that lacks ok is told so, and a diagnostic that is not a record is named by its place in the list — not as a member of it', () => {
  const lacking = result();
  delete lacking.ok;
  assert.ok(checkStageResult(lacking).includes('ok: is required'));
  assert.deepEqual(checkStageResult(result({ diagnostics: [diagnostic(), 'nope'], ok: false })), ['diagnostics[1]: a diagnostic must be a plain object']);
});

// ── the declared types ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the declarations accept what the contract allows and reject what it forbids — judged by TypeScript itself, with @ts-expect-error for every wrong shape', () => {
  const source = `
import type {
  ObixCompilerDiagnostic, ObixDiagnosticSeverity, ObixDiagnosticSpace, ObixSourcePosition, SourcePosition, SourceRange, ObixUpstreamError, ObixUpstreamPackage, ObixUpstreamEnum,
  ObixStageStatus, ObixStageResult,
} from "../dist/index.js";
import { positionAt, checkDiagnostic, isObixCompilerDiagnostic, OBIX_STAGE_STATUSES } from "../dist/index.js";

const smallest: ObixCompilerDiagnostic = { code: "OBIX_SFC_EMPTY_FILE", message: "m", severity: "error", filename: "A.obix" };
const populated = {
  code: "OBIX_TYPESCRIPT_SYNTAX_INVALID", message: "m", severity: "warning", filename: "A.obix",
  start: { line: 1, column: 1 }, end: { line: 1, column: 2, offset: 1 }, space: "generated",
  upstream: { package: "typescript", version: "6.0.3", enum: "TypeScriptDiagnostics", name: null, code: 1109 },
  detail: "d",
} satisfies ObixCompilerDiagnostic;
const severity: ObixDiagnosticSeverity = "warning";
const space: ObixDiagnosticSpace = "source";
const place: SourcePosition = positionAt("abc", 1);
const optionalOffset: ObixSourcePosition = place;
const range: SourceRange = { start: place, end: positionAt("abc", 2) };
const upstream: ObixUpstreamError = { package: "@vue/compiler-dom", version: "3.5.43", enum: "DOMErrorCodes", name: "X_MISSING_END_TAG", code: 24 };
const pkg: ObixUpstreamPackage = "@vue/compiler-sfc";
const vocabulary: ObixUpstreamEnum = "CompilerDeprecationTypes";
const status: ObixStageStatus = OBIX_STAGE_STATUSES[0];
const stage: ObixStageResult<{ code: string }> = { filename: "A.obix", status: "compiled", ok: true, artifact: { code: "" }, diagnostics: [smallest, populated] };
const noArtifact: ObixStageResult<never> = { filename: "A.obix", status: "absent", ok: true, artifact: null, diagnostics: [] };
const checked: readonly string[] = checkDiagnostic(smallest);
const narrowed: unknown = smallest;
if (isObixCompilerDiagnostic(narrowed)) { const code: string = narrowed.code; void code; }
void [severity, space, optionalOffset, range, upstream, pkg, vocabulary, status, stage, noArtifact, checked];

// @ts-expect-error a severity is error or warning
const badSeverity: ObixCompilerDiagnostic = { ...smallest, severity: "info" };
// @ts-expect-error a space is source or generated
const badSpace: ObixCompilerDiagnostic = { ...smallest, space: "mapped" };
// @ts-expect-error the upstream vocabulary is closed
const badUpstream: ObixCompilerDiagnostic = { ...smallest, upstream: { package: "react", version: "1", enum: null, name: null, code: null } };
// @ts-expect-error every upstream member is required (name, enum and code may be null, not absent)
const partialUpstream: ObixUpstreamError = { package: "typescript", version: "6.0.3" };
// @ts-expect-error a status is one of four
const badStatus: ObixStageStatus = "done";
// @ts-expect-error a range needs offsets: a position of a range has one
const rangeWithoutOffset: SourceRange = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };
// @ts-expect-error a diagnostic is read-only
smallest.code = "OBIX_SFC_OTHER";
// @ts-expect-error a diagnostic is read-only all the way down
place.line = 4;
// @ts-expect-error the diagnostics of a stage result are read-only
stage.diagnostics.push(smallest);
// @ts-expect-error an artifact is what the stage says it is
const wrongArtifact: ObixStageResult<{ code: string }> = { ...stage, artifact: { code: 3 } };
// @ts-expect-error a diagnostic needs its filename
const noFilename: ObixCompilerDiagnostic = { code: "OBIX_SFC_EMPTY_FILE", message: "m", severity: "error" };
void [badSeverity, badSpace, badUpstream, partialUpstream, badStatus, rangeWithoutOffset, wrongArtifact, noFilename];
`;
  const errors = typeErrors(source, path.join(PACKAGE, 'test', 'types.virtual.ts'));
  assert.deepEqual(errors, [], JSON.stringify(errors, null, 1));
});
