-- 2. Check tables and their schemas
SELECT 
    schemaname as schema,
    tablename as name,
    tableowner as owner
FROM pg_tables
WHERE schemaname IN ('public', 'cser')
ORDER BY schemaname, tablename;

-- 3. Check functions
