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
