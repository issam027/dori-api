const fs = require('node:fs');
const path = require('node:path');

// Split SQL without cutting quoted strings, comments or PL/pgSQL dollar bodies.
function statements(input) {
  const sql = input.replace(/^\\(?:un)?restrict.*$/gm, '');
  const result = [];
  let start = 0;
  let quote = null;
  let dollar = null;
  let block = 0;
  let line = false;
  for (let i = 0; i < sql.length; i++) {
    const current = sql[i];
    const next = sql[i + 1];
    if (line) {
      if (current === '\n') line = false;
      continue;
    }
    if (block) {
      if (current === '/' && next === '*') {
        block++;
        i++;
      } else if (current === '*' && next === '/') {
        block--;
        i++;
      }
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        i += dollar.length - 1;
        dollar = null;
      }
      continue;
    }
    if (quote) {
      if (current === quote) {
        if (next === quote) i++;
        else quote = null;
      }
      continue;
    }
    if (current === '-' && next === '-') {
      line = true;
      i++;
    } else if (current === '/' && next === '*') {
      block = 1;
      i++;
    } else if (current === "'" || current === '"') quote = current;
    else if (current === '$') {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tag) {
        dollar = tag[0];
        i += dollar.length - 1;
      }
    } else if (current === ';') {
      const statement = sql
        .slice(start, i + 1)
        .replace(/^(?:\s*--[^\n]*(?:\n|$))*/, '')
        .trim();
      if (statement) result.push(statement);
      start = i + 1;
    }
  }
  if (quote || dollar || block)
    throw new Error('Unclosed SQL quote or comment');
  const remainder = sql
    .slice(start)
    .replace(/--[^\n]*/g, '')
    .trim();
  if (remainder) throw new Error('Unexpected unterminated SQL statement');
  return result;
}

function consolidate(input) {
  const tables = new Map();
  const constraints = new Map();
  const groups = {
    settings: [],
    schemas: [],
    functions: [],
    indexes: [],
    triggers: [],
    comments: [],
  };
  for (const statement of statements(input)) {
    const table = /^CREATE TABLE ([\w.]+)\s*\(/.exec(statement);
    const constraint =
      /^ALTER TABLE ONLY ([\w.]+)\s+ADD CONSTRAINT ([\s\S]*);$/.exec(statement);
    if (table) tables.set(table[1], normalizeSets(statement));
    else if (constraint) {
      const entries = constraints.get(constraint[1]) ?? [];
      entries.push(normalizeSets('CONSTRAINT ' + constraint[2]));
      constraints.set(constraint[1], entries);
    } else if (/^(?:SET |SELECT pg_catalog\.set_config)/.test(statement))
      groups.settings.push(statement);
    else if (/^CREATE SCHEMA /.test(statement))
      groups.schemas.push(
        statement.replace('CREATE SCHEMA ', 'CREATE SCHEMA IF NOT EXISTS '),
      );
    else if (/^CREATE FUNCTION /.test(statement))
      groups.functions.push(statement);
    else if (/^CREATE (?:UNIQUE )?INDEX /.test(statement))
      groups.indexes.push(normalizeSets(statement));
    else if (/^CREATE (?:CONSTRAINT )?TRIGGER /.test(statement))
      groups.triggers.push(statement);
    else if (/^COMMENT ON /.test(statement)) groups.comments.push(statement);
    else
      throw new Error(
        'Unsupported schema statement: ' + statement.slice(0, 150),
      );
  }
  for (const name of constraints.keys())
    if (!tables.has(name))
      throw new Error('Missing table for constraint: ' + name);
  const ordered = [];
  const visited = new Set();
  const visiting = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    if (visiting.has(name)) throw new Error('Cyclic table dependency: ' + name);
    visiting.add(name);
    for (const constraint of constraints.get(name) ?? []) {
      const target = /REFERENCES ([\w.]+)/.exec(constraint)?.[1];
      if (target && target !== name) {
        if (!tables.has(target))
          throw new Error('Unknown foreign key target: ' + target);
        visit(target);
      }
    }
    const additions = constraints.get(name) ?? [];
    const table = tables.get(name);
    ordered.push(
      additions.length
        ? table.replace(
            /\s*\);$/,
            ',\n    ' + additions.join(',\n    ') + '\n);',
          )
        : table,
    );
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of [...tables.keys()].sort()) visit(name);
  const sections = [
    ['Session settings', groups.settings],
    [
      'Schemas and extensions',
      [
        ...groups.schemas,
        'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;',
        'CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;',
      ],
    ],
    ['Final tables, columns and constraints (dependency order)', ordered],
    ['Final functions (one definition per signature)', groups.functions],
    ['Indexes', groups.indexes],
    ['Triggers', groups.triggers],
    ['Schema documentation', groups.comments],
    [
      'Restore application defaults',
      [
        'SET check_function_bodies = true;',
        'SET search_path TO dorify, pg_catalog;',
      ],
    ],
  ];
  const output =
    '-- Dorify consolidated baseline.\n' +
    '-- Final schema after migrations 001..025; no historical column additions or data backfills.\n' +
    '-- Reference data and demo data are installed separately.\n\n' +
    sections
      .map(([title, entries]) => '-- ' + title + '\n\n' + entries.join('\n\n'))
      .join('\n\n');
  if (/^ALTER TABLE/im.test(output))
    throw new Error('Consolidation left an ALTER TABLE statement');
  return output + '\n';
}

// pg_dump expands IN/NOT IN to casted ANY/ALL arrays. Rebuild the original
// predicates instead of introducing per-element casts when parsing the dump again.
function normalizeSets(sql) {
  return sql.replace(
    /\(?\b([a-z_][a-z_0-9.]*)\)?::text\s*(=|<>)\s*(ANY|ALL)\s*\(\(?ARRAY\[([^\]]*)\]\)?::text\[\]\)/gi,
    (match, column, operator, quantifier, values) => {
      if (operator === '=' && quantifier.toUpperCase() === 'ANY')
        return (
          column + ' IN (' + values.replace(/::character varying/g, '') + ')'
        );
      if (operator === '<>' && quantifier.toUpperCase() === 'ALL')
        return (
          column +
          ' NOT IN (' +
          values.replace(/::character varying/g, '') +
          ')'
        );
      return match;
    },
  );
}

if (require.main === module) {
  const [, , source, destination] = process.argv;
  if (!source || !destination)
    throw new Error('Usage: node consolidate-schema.cjs dump.sql final.sql');
  const output = consolidate(fs.readFileSync(path.resolve(source), 'utf8'));
  fs.writeFileSync(path.resolve(destination), output);
  console.log('Consolidated schema written:', destination);
}
module.exports = { statements, consolidate };
