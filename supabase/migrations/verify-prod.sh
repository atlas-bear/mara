#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Verifying production database...${NC}"

# Get production database URL
DB_URL=$(supabase db remote psql --connection-string)
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to get production database URL. Make sure you're linked to the project:${NC}"
    echo -e "${BLUE}supabase link --project-ref pbhalkadbfdermkzerej${NC}"
    exit 1
fi

# Create output directory
mkdir -p migration_verification/production

# Check enums
echo -e "${GREEN}1. Checking enums...${NC}"
psql "$DB_URL" -t -A -F $'\t' -c "
SELECT 
    n.nspname as schema,
    t.typname as name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname IN ('public', 'cser')
GROUP BY schema, name
ORDER BY schema, name;" > migration_verification/production/1_enums.txt

# Check tables
echo -e "${GREEN}2. Checking tables...${NC}"
psql "$DB_URL" -t -A -F $'\t' -c "
SELECT 
    schemaname as schema,
    tablename as name,
    tableowner as owner
FROM pg_tables
WHERE schemaname IN ('public', 'cser')
ORDER BY schemaname, tablename;" > migration_verification/production/2_tables.txt

# Check functions
echo -e "${GREEN}3. Checking functions...${NC}"
psql "$DB_URL" -t -A -F $'\t' -c "
SELECT 
    n.nspname as schema,
    p.proname as name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'cser')
ORDER BY schema, name;" > migration_verification/production/3_functions.txt

# Check triggers
echo -e "${GREEN}4. Checking triggers...${NC}"
psql "$DB_URL" -t -A -F $'\t' -c "
SELECT 
    n.nspname as schema,
    c.relname as table_name,
    t.tgname as trigger_name,
    pg_get_triggerdef(t.oid) as definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname IN ('public', 'cser')
AND NOT t.tgisinternal
ORDER BY schema, table_name, trigger_name;" > migration_verification/production/4_triggers.txt

# Check indexes
echo -e "${GREEN}5. Checking indexes...${NC}"
psql "$DB_URL" -t -A -F $'\t' -c "
SELECT 
    n.nspname as schema,
    c.relname as table_name,
    i.relname as index_name,
    pg_get_indexdef(i.oid) as definition
FROM pg_index x
JOIN pg_class c ON c.oid = x.indrelid
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'cser')
ORDER BY schema, table_name, index_name;" > migration_verification/production/5_indexes.txt

# Check RLS policies
echo -e "${GREEN}6. Checking RLS policies...${NC}"
psql "$DB_URL" -t -A -F $'\t' -c "
SELECT 
    n.nspname as schema,
    c.relname as table_name,
    p.polname as policy_name,
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
ORDER BY schema, table_name, policy_name;" > migration_verification/production/6_policies.txt

# Check data
echo -e "${GREEN}7. Checking data...${NC}"
psql "$DB_URL" -t -A -F $'\t' -c "
-- Check processing status distribution
SELECT processing_status, count(*)
FROM cser.raw_data
GROUP BY processing_status
ORDER BY processing_status;

-- Check email categories
SELECT id, name, default_frequency, default_format
FROM public.email_categories
ORDER BY id;" > migration_verification/production/7_data.txt

echo -e "${BLUE}Production verification complete. Results saved in migration_verification/production${NC}"

# Compare results
echo -e "${BLUE}Comparing local and production results...${NC}"
for i in {1..7}; do
    echo -e "${GREEN}Comparing section ${i}...${NC}"
    diff -u "migration_verification/local/${i}"* "migration_verification/production/${i}"*
done
