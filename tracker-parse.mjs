// ── Shared tracker (applications.md) column parsing ─────────────────
// Single source of truth for reading the Markdown applications tracker so every
// reader — merge-tracker, dedup-tracker, analyze-patterns, followup-cadence,
// update-system — stays in lockstep. The tracker table may use the original
// 9-column layout or a customized one with an extra/reordered column (e.g. a
// Location column after Role), so columns are mapped by header NAME rather than
// fixed position. Falls back to the legacy layout when no header row is found.
//
// A "colmap" maps a field name → the index into `line.split('|')`. Because the
// table rows start with a leading `|`, split index 0 is the empty cell before
// it, so the first real column ("#") lives at index 1.

// Legacy / default 9-column layout: | # | Date | Company | Role | Score | Status | PDF | Report | Notes |
export const LEGACY_COLMAP = {
  num: 1,
  date: 2,
  company: 3,
  role: 4,
  score: 5,
  status: 6,
  pdf: 7,
  report: 8,
  notes: 9,
};

// Header text (lowercased) → canonical field name. Supports the English tracker
// plus the Spanish headings the original system shipped with.
export const HEADER_ALIASES = {
  '#': 'num',
  'no': 'num',
  'no.': 'num',
  'num': 'num',
  'id': 'num',
  'date': 'date',
  'fecha': 'date',
  'company': 'company',
  'empresa': 'company',
  'role': 'role',
  'puesto': 'role',
  'position': 'role',
  'title': 'role',
  'location': 'location',
  'ubicacion': 'location',
  'ubicación': 'location',
  'loc': 'location',
  'score': 'score',
  'puntuacion': 'score',
  'puntuación': 'score',
  'rating': 'score',
  'status': 'status',
  'estado': 'status',
  'pdf': 'pdf',
  'cv': 'pdf',
  'report': 'report',
  'informe': 'report',
  'reporte': 'report',
  'notes': 'notes',
  'note': 'notes',
  'notas': 'notes',
};

/** True when a `|`-delimited line looks like the table's header row. */
function isHeaderLine(line) {
  if (!line.startsWith('|')) return false;
  if (line.includes('---')) return false; // separator row
  const lower = line.toLowerCase();
  // Needs at least a company + (status or score) heading to be a real header.
  const hasCompany = lower.includes('company') || lower.includes('empresa');
  const hasStatus = lower.includes('status') || lower.includes('estado');
  const hasScore = lower.includes('score') || lower.includes('puntuaci');
  return hasCompany && (hasStatus || hasScore);
}

/**
 * Detect the tracker's column layout from its header row.
 *
 * @param {string[]} lines - All lines of applications.md.
 * @returns {object|null} A field→index colmap, or null when no header is found.
 */
export function detectColumns(lines) {
  if (!Array.isArray(lines)) return null;
  const header = lines.find(isHeaderLine);
  if (!header) return null;

  const cells = header.split('|').map((s) => s.trim().toLowerCase());
  const map = {};
  cells.forEach((cell, idx) => {
    const field = HEADER_ALIASES[cell];
    // First match wins so a stray later cell can't overwrite a real column.
    if (field && map[field] == null) map[field] = idx;
  });

  // A usable layout must at least locate the id, company and status columns.
  if (map.num == null || map.company == null || map.status == null) return null;
  return map;
}

/**
 * Resolve the column layout for a tracker file: the detected header layout when
 * present, otherwise the legacy default. Convenience wrapper used by readers
 * that don't need the mutable two-step dance merge-tracker performs.
 *
 * @param {string[]} lines - All lines of applications.md.
 * @returns {object} A field→index colmap.
 */
export function resolveColumns(lines) {
  return detectColumns(lines) || LEGACY_COLMAP;
}

/**
 * Parse one Markdown applications.md table row into a tracker object using the
 * given column map. Header, separator and malformed rows return null. The raw
 * line is preserved so callers can locate and replace the exact tracker line.
 *
 * @param {string} line - One line from applications.md.
 * @param {object} colmap - A field→index map (see resolveColumns/detectColumns).
 * @returns {object|null} Parsed tracker row, or null for non-data lines.
 */
export function parseTrackerRow(line, colmap) {
  if (typeof line !== 'string' || !line.startsWith('|')) return null;
  const map = colmap || LEGACY_COLMAP;
  const parts = line.split('|').map((s) => s.trim());
  const maxIdx = Math.max(...Object.values(map));
  if (parts.length <= maxIdx) return null;

  const num = parseInt(parts[map.num], 10);
  if (isNaN(num) || num === 0) return null; // header/separator/non-data

  return {
    num,
    date: parts[map.date],
    company: parts[map.company],
    role: parts[map.role],
    location: map.location != null ? parts[map.location] : undefined,
    score: parts[map.score],
    status: parts[map.status],
    pdf: parts[map.pdf],
    report: parts[map.report],
    notes: map.notes != null ? (parts[map.notes] || '') : '',
    raw: line,
  };
}

export default { LEGACY_COLMAP, HEADER_ALIASES, detectColumns, resolveColumns, parseTrackerRow };
