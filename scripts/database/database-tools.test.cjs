const test = require('node:test');
const assert = require('node:assert/strict');
const { statements, consolidate } = require('./consolidate-schema.cjs');
const { random, seedTunisiaDemo } = require('./seed-tunisia-demo.cjs');

test('SQL splitter preserves semicolons inside functions, strings and nested comments', () => {
  const sql =
    "SELECT 'l''été;'; /* outer; /* inner; */ */ SELECT 2; CREATE FUNCTION f() RETURNS void AS $body$ BEGIN PERFORM ';'; END $body$ LANGUAGE plpgsql;";
  const split = statements(sql);
  assert.equal(split.length, 3);
  assert.match(split[0], /l''été;/);
  assert.match(split[2], /PERFORM ';'/);
});

test('consolidation orders foreign keys and places constraints inside final table definitions', () => {
  const output = consolidate(`
    CREATE SCHEMA dorify;
    CREATE TABLE dorify.child (id uuid NOT NULL, parent_id uuid NOT NULL);
    CREATE TABLE dorify.parent (id uuid NOT NULL);
    ALTER TABLE ONLY dorify.child ADD CONSTRAINT child_pk PRIMARY KEY (id);
    ALTER TABLE ONLY dorify.parent ADD CONSTRAINT parent_pk PRIMARY KEY (id);
    ALTER TABLE ONLY dorify.child ADD CONSTRAINT child_parent_fk FOREIGN KEY (parent_id) REFERENCES dorify.parent(id);
  `);
  assert.ok(
    output.indexOf('CREATE TABLE dorify.parent') <
      output.indexOf('CREATE TABLE dorify.child'),
  );
  assert.match(output, /CONSTRAINT child_parent_fk FOREIGN KEY/);
  assert.doesNotMatch(output, /ALTER TABLE/);
});

test('consolidation rejects unsupported statements instead of silently dropping them', () => {
  assert.throws(
    () => consolidate('CREATE VIEW dorify.unexpected AS SELECT 1;'),
    /Unsupported|Unhandled|Unexpected/i,
  );
});

test('demo randomness is reproducible and distinct seeds produce distinct samples', () => {
  const sample = (seed) => {
    const rng = random(seed);
    return Array.from({ length: 50 }, () => rng());
  };
  assert.deepEqual(sample(42), sample(42));
  assert.notDeepEqual(sample(42), sample(43));
  assert.ok(sample(42).every((value) => value >= 0 && value < 1));
});

test('intra seed rejects multiple sites before touching the database', async () => {
  await assert.rejects(
    seedTunisiaDemo(
      {
        query: () => {
          throw new Error('Unexpected query');
        },
      },
      { kind: 'intra', siteCount: 2 },
    ),
    /Invalid demo scope/,
  );
});
