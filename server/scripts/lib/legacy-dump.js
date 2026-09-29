import { readFile } from 'node:fs/promises';

const ESCAPES = { n: '\n', r: '\r', t: '\t', 0: '\0', b: '\b', Z: '\x1a' };

const unescape = (raw) =>
  raw.replace(/\\(x[0-9a-fA-F]{2}|.)/g, (match, char) => {
    if (char[0] === 'x') return String.fromCharCode(parseInt(char.slice(1), 16));
    return ESCAPES[char] ?? char;
  });

/**
 * Parses a phpMyAdmin MySQL dump into rows keyed by column name. Values are
 * returned as JS primitives: number, null, or string. No SQL is ever built
 * from these, they only become bound parameters.
 */
export const parseDump = (sql) => {
  const tables = new Map();
  const pattern = /INSERT INTO `([^`]+)`\s*\(([^)]*)\)\s*VALUES\s*/g;
  let match;

  while ((match = pattern.exec(sql)) !== null) {
    const table = match[1];
    const columns = match[2].split(',').map((c) => c.trim().replace(/`/g, ''));
    const rows = [];
    let i = pattern.lastIndex;

    while (i < sql.length) {
      while (i < sql.length && /[\s,]/.test(sql[i])) i += 1;
      if (sql[i] === ';' || sql[i] === '\n' || i >= sql.length) {
        if (sql[i] === '\n' && rows.length) break;
        break;
      }
      if (sql[i] !== '(') break;

      i += 1;
      const values = [];
      let field = '';
      let quoted = false;

      while (i < sql.length) {
        const ch = sql[i];

        if (quoted) {
          if (ch === '\\') {
            field += ch + sql[i + 1];
            i += 2;
            continue;
          }
          if (ch === "'") {
            quoted = false;
            i += 1;
            continue;
          }
          field += ch;
          i += 1;
          continue;
        }

        if (ch === "'") {
          quoted = true;
          i += 1;
          continue;
        }
        if (ch === ',') {
          values.push(field);
          field = '';
          i += 1;
          continue;
        }
        if (ch === ')') {
          values.push(field);
          i += 1;
          break;
        }
        field += ch;
        i += 1;
      }

      const cleaned = values.map((value) => {
        const trimmed = value.trim();
        if (trimmed.toUpperCase() === 'NULL') return null;
        const numeric = Number(trimmed);
        return trimmed !== '' && Number.isFinite(numeric) ? numeric : unescape(trimmed);
      });

      rows.push(Object.fromEntries(columns.map((column, index) => [column, cleaned[index] ?? null])));
      while (i < sql.length && /\s/.test(sql[i])) i += 1;
      if (sql[i] === ',') i += 1;
      else break;
    }

    tables.set(table, [...(tables.get(table) ?? []), ...rows]);
    pattern.lastIndex = i;
  }

  return tables;
};

export const readDump = async (path) => parseDump(await readFile(path, 'utf8'));
