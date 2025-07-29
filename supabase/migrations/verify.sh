#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to run verification queries and save results
run_verification() {
    local env=$1
    local output_dir="migration_verification/${env}"
    
    echo -e "${BLUE}Running verification for ${env} environment...${NC}"
    
    # Create output directory
    mkdir -p "$output_dir"
    
    # Run each verification section
    echo -e "${GREEN}1. Checking enums...${NC}"
    psql "$DATABASE_URL" -f verify_sections/1_enums.sql -o "${output_dir}/1_enums.txt"
    
    echo -e "${GREEN}2. Checking tables...${NC}"
    psql "$DATABASE_URL" -f verify_sections/2_tables.sql -o "${output_dir}/2_tables.txt"
    
    echo -e "${GREEN}3. Checking functions...${NC}"
    psql "$DATABASE_URL" -f verify_sections/3_functions.sql -o "${output_dir}/3_functions.txt"
    
    echo -e "${GREEN}4. Checking triggers...${NC}"
    psql "$DATABASE_URL" -f verify_sections/4_triggers.sql -o "${output_dir}/4_triggers.txt"
    
    echo -e "${GREEN}5. Checking indexes...${NC}"
    psql "$DATABASE_URL" -f verify_sections/5_indexes.sql -o "${output_dir}/5_indexes.txt"
    
    echo -e "${GREEN}6. Checking RLS policies...${NC}"
    psql "$DATABASE_URL" -f verify_sections/6_policies.sql -o "${output_dir}/6_policies.txt"
    
    echo -e "${GREEN}7. Checking data...${NC}"
    psql "$DATABASE_URL" -f verify_sections/7_data.sql -o "${output_dir}/7_data.txt"
    
    echo -e "${BLUE}Verification complete for ${env}. Results saved in ${output_dir}${NC}"
}

# Create directories for verification queries
mkdir -p verify_sections

# Split VERIFY.sql into sections
awk '/--\[ Schema Verification \]--/,/--\[ Data Verification \]--/' supabase/migrations/VERIFY.sql | \
    awk '/-- 1\. Check enums/,/-- 2\./' > verify_sections/1_enums.sql

awk '/-- 2\. Check tables/,/-- 3\./' supabase/migrations/VERIFY.sql > verify_sections/2_tables.sql

awk '/-- 3\. Check functions/,/-- 4\./' supabase/migrations/VERIFY.sql > verify_sections/3_functions.sql

awk '/-- 4\. Check triggers/,/-- 5\./' supabase/migrations/VERIFY.sql > verify_sections/4_triggers.sql

awk '/-- 5\. Check indexes/,/-- 6\./' supabase/migrations/VERIFY.sql > verify_sections/5_indexes.sql

awk '/-- 6\. Check RLS policies/,/--\[ Data Verification \]--/' supabase/migrations/VERIFY.sql > verify_sections/6_policies.sql

awk '/--\[ Data Verification \]--/,/--\[ Function Testing \]--/' supabase/migrations/VERIFY.sql > verify_sections/7_data.sql

# Run verification for local database
echo -e "${BLUE}Verifying local database...${NC}"
export DATABASE_URL="postgres://postgres:postgres@localhost:54322/postgres"
run_verification "local"

# Run verification for production database
echo -e "${BLUE}Verifying production database...${NC}"
export DATABASE_URL=$(supabase status --db-url)
run_verification "production"

# Compare results
echo -e "${BLUE}Comparing results...${NC}"
for section in {1..7}; do
    echo -e "${GREEN}Comparing section ${section}...${NC}"
    diff -u "migration_verification/local/${section}"* "migration_verification/production/${section}"* || true
done

echo -e "${BLUE}Verification complete. Check the migration_verification directory for detailed results.${NC}"
