-- 5. Check indexes
SELECT 
    n.nspname as schema,
    c.relname as table,
    i.relname as index,
    pg_get_indexdef(i.oid) as definition
FROM pg_index x
JOIN pg_class c ON c.oid = x.indrelid
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'cser')
ORDER BY schema, table, index;

-- 6. Check RLS policies
