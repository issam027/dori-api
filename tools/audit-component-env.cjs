/* Read-only inventory. Prints variable names only, never values. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const builtins = new Set(['DEV', 'PROD', 'MODE', 'BASE_URL', 'SSR']);
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory()) return ['node_modules', '.git', 'generated', 'dist', 'data', 'test', 'tests', 'artifacts'].includes(e.name) ? [] : walk(path.join(dir, e.name));
    return /\.(?:ts|tsx|js|mjs|cjs)$/.test(e.name) && !/\.(?:test|spec)\./.test(e.name) ? [path.join(dir, e.name)] : [];
  });
}
let missing = 0;
for (const component of ['dori-api', 'dori-web', 'dori-site', 'dori-agent']) {
  const dir = path.join(root, component);
  const used = new Set();
  const files = component === 'dori-site' ? ['server.js', 'mail', 'tools'].flatMap(name => {
    const target = path.join(dir, name); return fs.statSync(target).isDirectory() ? walk(target) : [target];
  }) : walk(path.join(dir, 'src'));
  if (component === 'dori-web') files.push(path.join(dir, 'vite.config.ts'));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of [/(?:process\.env|import\.meta\.env|\benv|\benvironment|\bparsed)\.([A-Z][A-Z0-9_]*)/g, /\binteger\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g]) {
      for (const match of source.matchAll(pattern)) if (!builtins.has(match[1])) used.add(match[1]);
    }
  }
  const template = fs.readFileSync(path.join(dir, '.env.example'), 'utf8');
  const declared = new Set([...template.matchAll(/^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]));
  const gaps = [...used].filter(key => !declared.has(key)).sort();
  const composeGaps = [];
  for (const name of fs.readdirSync(dir).filter(name => /^compose\..*(cloud|intra|oracle)\.yaml$/.test(name))) {
    const compose = fs.readFileSync(path.join(dir, name), 'utf8');
    for (const match of compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)) {
      const oracleTemplate = path.join(dir, '.env.oracle.example');
      const catalog = template + (name.includes('oracle') && fs.existsSync(oracleTemplate) ? fs.readFileSync(oracleTemplate, 'utf8') : '');
      if (!new RegExp('^\\s*(?:#\\s*)?' + match[1] + '=', 'm').test(catalog)) composeGaps.push(`${name}:${match[1]}`);
    }
  }
  missing += gaps.length + composeGaps.length;
  console.log(JSON.stringify({ component, runtimeVariables: used.size, missingRuntimeDeclarations: gaps, missingComposeDeclarations: [...new Set(composeGaps)] }));
}
if (missing) process.exitCode = 1;
