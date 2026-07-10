// ── Shared tracker (applications.md) row writing ────────────────────
// Companion to tracker-parse.mjs. dedup-tracker and normalize-statuses both
// mutate a row's cells in place (e.g. promote a status, move a note) and then
// need to serialize the cell array back into a Markdown table row. That
// reconstruction was duplicated in both files; it lives here so they stay in
// lockstep.

/**
 * Rebuild a Markdown applications.md row from a `line.split('|')` cell array.
 *
 * The array is produced by `line.split('|').map(s => s.trim())`, so:
 *   - index 0 is the empty boundary cell before the leading `|`.
 *   - the final element is an empty boundary cell ONLY when the row was written
 *     with a trailing `|`. A row written without a trailing pipe keeps its real
 *     last cell (the notes) at the end — dropping it would silently lose data.
 *
 * We therefore always strip the leading boundary, but only strip a trailing
 * boundary when it is actually empty, then re-wrap with `| … |`. This
 * round-trips a well-formed (trailing-pipe) row unchanged and repairs a
 * no-trailing-pipe row by appending the missing pipe.
 *
 * @param {string[]} parts - Trimmed cells from `line.split('|')`.
 * @returns {string} A normalized Markdown table row.
 */
export function rebuildRow(parts) {
  const cells = Array.isArray(parts) ? parts.slice() : [];
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return `| ${cells.join(' | ')} |`;
}

export default { rebuildRow };
