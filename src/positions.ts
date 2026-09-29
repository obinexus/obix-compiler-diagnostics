/**
 * Positions in the official convention — 1-based `line` and `column`, and the 0-based character `offset` from the start of the source — for every stage that has an
 * offset and needs to say where it is. A line ends at `\n` (a `\r\n` file counts one line per pair, and the `\r` belongs to the line it ends).
 *
 * Moved here from the parser package (`ObixSourcePosition`, `positionAt`) and from the SFC package (`SourcePosition`, `SourceRange`); nothing about them changed.
 */

/** A place in a source text, as a diagnostic reports it. The `offset` is optional here: a place an upstream compiler gives only as a line and a column is still a place. */
export interface ObixSourcePosition {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
}

/** A place whose `offset` is known — what `positionAt` derives and what a source range is made of. */
export interface SourcePosition extends ObixSourcePosition {
  readonly offset: number;
}

/** From `start` to `end` in a source text: the location of a block, of a node, of the text a diagnostic points at. */
export interface SourceRange {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

/** The frozen position of `offset` in `source`. The offset is clamped into the source: a position is never outside the text it names. */
export function positionAt(source: string, offset: number): SourcePosition {
  const at = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < at; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return Object.freeze({ line, column: at - lineStart + 1, offset: at });
}
