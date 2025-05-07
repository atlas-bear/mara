-- 1. Check enums and their values
SELECT 
    n.nspname as schema,
    t.typname as name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname IN ('public', 'cser')
GROUP BY schema, name
ORDER BY schema, name;

-- 2. Check tables and their schemas
