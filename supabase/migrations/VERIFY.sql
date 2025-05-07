-- Verification queries for migration fixes
-- Run these against both local and production databases to verify alignment

--[ Schema Verification ]--

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
SELECT 
    schemaname as schema,
    tablename as name,
    tableowner as owner
FROM pg_tables
WHERE schemaname IN ('public', 'cser')
ORDER BY schemaname, tablename;

-- 3. Check functions
SELECT 
    n.nspname as schema,
    p.proname as name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'cser')
ORDER BY schema, name;

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

-- 1. Check processing status distribution
SELECT processing_status, count(*)
FROM cser.raw_data
GROUP BY processing_status
ORDER BY processing_status;

-- 2. Check email categories
SELECT id, name, default_frequency, default_format
FROM public.email_categories
ORDER BY id;

-- 3. Check email queue status
SELECT status, priority, count(*)
FROM public.email_queue
GROUP BY status, priority
ORDER BY priority, status;

-- 4. Check rate limits
SELECT 
    rate_limit_key,
    date_trunc('hour', window_start) as hour,
    sum(current_count) as total_count,
    max(max_count) as limit
FROM public.email_rate_limits
WHERE window_start >= now() - interval '24 hours'
GROUP BY rate_limit_key, date_trunc('hour', window_start)
ORDER BY hour DESC, rate_limit_key;

--[ Function Testing ]--

-- 1. Test email preference initialization
SELECT should_send_email('00000000-0000-0000-0000-000000000000'::uuid, 'weekly-report');

-- 2. Test rate limiting
SELECT check_email_rate_limit('test_limit', interval '1 hour', 10);

-- 3. Test next email processing
SELECT get_next_email_to_process();

-- Note: Some functions can't be tested directly as they require specific data
-- or are triggered by events. These should be tested through the application.
