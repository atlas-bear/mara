-- 4. Check triggers
SELECT 
    n.nspname as schema,
    c.relname as table,
    t.tgname as trigger,
    pg_get_triggerdef(t.oid) as definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname IN ('public', 'cser')
AND NOT t.tgisinternal
ORDER BY schema, table, trigger;

-- 5. Check indexes
