// Simple Supabase Connection Test Script

import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";

// --- Configuration ---
dotenv.config({ path: path.resolve(process.cwd(), "scripts/migration/.env") }); // Load .env file

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function testConnection() {
  console.log("Attempting to connect to Supabase...");
  console.log("URL:", SUPABASE_URL ? "Loaded" : "MISSING!");
  console.log("Service Key:", SUPABASE_SERVICE_KEY ? "Loaded" : "MISSING!");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in scripts/migration/.env"
    );
    process.exit(1);
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
      },
    });
    console.log("Supabase client initialized.");

    // Attempt a simple query (ensure 'cser' is in search_path)
    console.log("Attempting simple query: SELECT count(*) FROM incident_type");
    const { data, error } = await supabase
      .from("incident_type") // Assumes 'cser' is in search_path
      .select("count", { count: "exact" }); // Get the count

    if (error) {
      console.error("!!! Query FAILED:");
      console.error("Error Code:", error.code);
      console.error("Error Message:", error.message);
      console.error("Error Details:", error.details);
      console.error("Full Error Object:", error);
    } else {
      console.log("Query SUCCEEDED.");
      console.log("Count result:", data); // Should show [{ count: N }]
    }
  } catch (err) {
    console.error("!!! UNEXPECTED ERROR during connection/query:");
    console.error(err);
  }
}

testConnection();
