// Parses team registration CSVs, including Google Form exports, by reading
// column headers instead of assuming a fixed column order.

const PLACEHOLDERS = new Set(['', '-', '--', 'n/a', 'na', 'none', 'nil', 'any', 'tbd', 'null']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.map(r => r.map(v => v.trim())).filter(r => r.some(Boolean));
}

const clean = value => (PLACEHOLDERS.has(String(value || '').trim().toLowerCase()) ? '' : String(value).trim());
const cleanEmail = value => {
  const email = clean(value).toLowerCase();
  return EMAIL_RE.test(email) ? email : '';
};

function findColumns(header) {
  const h = header.map(v => v.toLowerCase());
  const find = (...tests) => h.findIndex(col => tests.every(t => t.test(col)));
  const speaker = n => new RegExp(`(speaker|debater|member|s)\\s*-?\\s*${n}\\b`);
  return {
    name: find(/team/, /name/) >= 0 ? find(/team/, /name/) : find(/^team$/),
    institution: find(/institution|school|university|college/),
    s1: find(speaker(1), /name/),
    s1e: find(speaker(1), /e-?mail/),
    s2: find(speaker(2), /name/),
    s2e: find(speaker(2), /e-?mail/),
    division: find(/division|category/)
  };
}

// Returns { teams: [...], warnings: [...] } with teams ready to insert
// (minus tournament_id / emoji).
export function teamsFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { teams: [], warnings: ['The CSV has no data rows.'] };
  let cols = findColumns(rows[0]);
  if (cols.s1 < 0 || cols.s2 < 0) {
    // Legacy fixed order: Team Name, Institution, S1 Name, S1 Email, S2 Name, S2 Email, Division
    cols = { name: 0, institution: 1, s1: 2, s1e: 3, s2: 4, s2e: 5, division: 6 };
  }
  const get = (row, index) => (index >= 0 ? row[index] || '' : '');
  const warnings = [];
  const teams = rows.slice(1).map((row, i) => {
    const line = i + 2;
    let s1 = clean(get(row, cols.s1));
    let s1e = cleanEmail(get(row, cols.s1e));
    let s2 = clean(get(row, cols.s2));
    let s2e = cleanEmail(get(row, cols.s2e));
    // A valid email typed into the wrong slot (e.g. speaker 1's email under speaker 2).
    if (!s1e && !s2 && s2e) { s1e = s2e; s2e = ''; s2 = clean(get(row, cols.s1e)); }
    if (!s1 && s2) { s1 = s2; s1e = s1e || s2e; s2 = ''; s2e = ''; }
    if (!s1) { warnings.push(`Row ${line}: skipped (no speaker name).`); return null; }
    if (!s2) {
      s2 = 'TBD';
      warnings.push(`Row ${line}: ${s1} has no partner — added with "TBD".`);
    }
    if (clean(get(row, cols.s1e)) && !s1e) warnings.push(`Row ${line}: "${get(row, cols.s1e)}" is not a valid email for ${s1}.`);
    const name = clean(get(row, cols.name)) || (s2 === 'TBD' ? `${s1} (needs partner)` : `${s1.split(' ')[0]} & ${s2.split(' ')[0]}`);
    return {
      name,
      institution: clean(get(row, cols.institution)) || null,
      speaker1_name: s1,
      speaker1_email: s1e || null,
      speaker2_name: s2,
      speaker2_email: s2e || null,
      division: clean(get(row, cols.division)) || 'Open'
    };
  }).filter(Boolean);
  return { teams, warnings };
}
