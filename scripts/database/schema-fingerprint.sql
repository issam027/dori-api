-- Stable structural inventory; excludes the migration ledger and physical OIDs.
SET search_path TO pg_catalog;
SELECT kind, identity, definition FROM (
  SELECT 'column' AS kind,
    n.nspname || '.' || c.relname || '.' || a.attname AS identity,
    a.attnum::text || '|' || format_type(a.atttypid, a.atttypmod) || '|' ||
    a.attnotnull::text || '|' || COALESCE(pg_get_expr(d.adbin, d.adrelid), '') AS definition
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind='r'
    AND n.nspname IN ('dorify','dorify_agent') AND c.relname<>'dori_schema_migration'
  UNION ALL
  SELECT 'constraint', n.nspname || '.' || c.relname || '.' || con.conname,
    pg_get_constraintdef(con.oid, true)
  FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('dorify','dorify_agent') AND c.relname<>'dori_schema_migration' AND con.contype <> 'n'
  UNION ALL
  SELECT 'index', schemaname || '.' || indexname, indexdef
  FROM pg_indexes WHERE schemaname IN ('dorify','dorify_agent') AND tablename<>'dori_schema_migration'
  UNION ALL
  SELECT 'function', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    pg_get_functiondef(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('dorify','dorify_agent')
  UNION ALL
  SELECT 'trigger', n.nspname || '.' || c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid, true)
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE NOT t.tgisinternal AND n.nspname IN ('dorify','dorify_agent')
) catalog ORDER BY kind, identity;
