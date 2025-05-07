-- 6. Check RLS policies
SELECT 
    n.nspname as schema,
    c.relname as table,
    p.polname as policy,
    pg_get_expr(p.polqual, p.polrelid) as using_expr,
    pg_get_expr(p.polwithcheck, p.polrelid) as check_expr,
    CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
    END as command
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname IN ('public', 'cser')
ORDER BY schema, table, policy;

--[ Data Verification ]--
