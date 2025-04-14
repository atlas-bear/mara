// MARA Airtable to Supabase Migration Script

import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// --- Configuration ---
dotenv.config({ path: path.resolve(process.cwd(), "scripts/migration/.env") }); // Load .env file from script directory

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CSV_EXPORT_DIR = path.resolve(process.cwd(), "data/airtable_exports"); // Path to exported CSVs

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in scripts/migration/.env"
  );
  process.exit(1);
}

// Initialize Supabase client
// Note: Using the Service Role Key bypasses RLS. Be careful!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false, // Don't persist session for scripts
  },
  // Explicitly specify the schema to use, overriding search_path issues
  db: {
    schema: "cser",
  },
});

// --- Helper Functions ---

/**
 * Reads and parses a CSV file.
 * @param {string} filename - The name of the CSV file (without path).
 * @returns {Promise<Array<Object>>} - A promise that resolves with an array of objects representing CSV rows.
 */
async function readCsv(filename) {
  const filePath = path.join(CSV_EXPORT_DIR, filename);
  console.log(`Reading CSV: ${filePath}`);
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log(
            `Successfully parsed ${results.data.length} rows from ${filename}`
          );
          resolve(results.data);
        },
        error: (error) => {
          console.error(`Error parsing ${filename}:`, error);
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error; // Re-throw error to stop execution if file reading fails
  }
}

/**
 * Inserts data into a Supabase table with basic error handling.
 * @param {string} tableName - The name of the Supabase table (e.g., 'cser.incident_type').
 * @param {Array<Object>} data - An array of objects to insert.
 * @param {number} [batchSize=500] - Number of rows per insert batch.
 * @param {object} [options={}] - Optional parameters.
 * @param {string} [options.onConflict] - Column name(s) for conflict resolution (upsert).
 * @param {boolean} [options.ignoreDuplicates=false] - If true, ignores duplicate key errors (23505) instead of failing the batch.
 * @returns {Promise<Array<Object>>} - A promise resolving with the inserted/upserted data (or null on error).
 */
async function insertData(tableName, data, batchSize = 500, options = {}) {
  if (!data || data.length === 0) {
    console.log(`No data provided for ${tableName}, skipping insert.`);
    return [];
  }

  console.log(`Inserting ${data.length} rows into ${tableName}...`);
  const insertedData = [];
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    try {
      let query;
      if (options.onConflict) {
        // Use correct upsert syntax
        query = supabase
          .from(tableName.split(".")[1]) // Extract table name
          .upsert(batch, { onConflict: options.onConflict }) // Pass data and options directly
          .select();
      } else {
        // Regular insert
        query = supabase
          .from(tableName.split(".")[1]) // Extract table name
          .insert(batch)
          .select();
      }

      const { data: result, error } = await query;

      if (error) {
        // Log the full error object for more details
        console.error(
          `Error inserting batch into ${tableName} (rows ${i + 1}-${i + batch.length}):`,
          error // Log the entire error object
        );

        // Specific handling for duplicate key errors if ignoreDuplicates is true
        if (options.ignoreDuplicates && error.code === "23505") {
          console.warn(
            `---> Ignoring duplicate key error (23505) for batch in ${tableName}.`
          );
          continue; // Skip this batch and continue with the next
        }

        // Decide if you want to stop on other errors or continue
        // throw error; // Option: Stop execution on first error
        continue; // Option: Log error and continue with next batch
      }

      if (result) {
        insertedData.push(...result);
        console.log(
          `Successfully inserted batch into ${tableName} (rows ${i + 1}-${i + batch.length})`
        );
      } else {
        console.warn(
          `Insert batch into ${tableName} (rows ${i + 1}-${i + batch.length}) returned no data.`
        );
      }
    } catch (err) {
      console.error(
        `Unexpected error during insert batch into ${tableName}:`,
        err
      );
      // Decide how to handle unexpected errors
      // throw err; // Option: Stop execution
      continue; // Option: Log error and continue
    }
  }
  console.log(
    `Finished inserting data into ${tableName}. Total inserted: ${insertedData.length}`
  );
  return insertedData;
}

// --- Migration Logic ---

// Store mappings from Airtable IDs/Names to Supabase UUIDs
const mappings = {
  incidentType: new Map(), // Airtable Name -> Supabase UUID
  weapon: new Map(), // Airtable Name -> Supabase UUID
  itemStolen: new Map(), // Airtable Name -> Supabase UUID
  responseType: new Map(), // Airtable Name -> Supabase UUID
  authority: new Map(), // Airtable Name -> Supabase UUID
  vessel: new Map(), // Airtable Record ID -> Supabase UUID
  incident: new Map(), // Airtable Record ID -> Supabase UUID
  rawData: new Map(), // Airtable Record ID -> Supabase UUID
};

async function migrateLookupTable(
  airtableCsvFilename,
  supabaseTableName,
  mapKey
) {
  // Use the exact column header from the CSV for the name/primary field
  const airtableNameField = "name"; // <<< CORRECTED based on user feedback

  try {
    // Test insert removed

    const data = await readCsv(airtableCsvFilename);
    const uniqueData = [];
    const seenNames = new Set();

    for (const row of data) {
      const name = row[airtableNameField]?.trim();
      if (name && !seenNames.has(name)) {
        uniqueData.push({ name: name }); // Add other fields like 'description' if they exist
        seenNames.add(name);
      }
    }

    // Upsert based on the 'name' column to handle potential duplicates
    const inserted = await insertData(supabaseTableName, uniqueData, 500, {
      onConflict: "name",
    });
    inserted.forEach((item) => mappings[mapKey].set(item.name, item.id));
    console.log(`Mapped ${mappings[mapKey].size} unique items for ${mapKey}`);
  } catch (error) {
    console.error(`Failed to migrate ${supabaseTableName}:`, error);
    throw error; // Stop migration if a lookup table fails
  }
}

async function migrateVessels() {
  const airtableCsvFilename = "cser_vessel.csv"; // Updated filename
  const airtableIdField = "record_id"; // Updated header
  const airtableNameField = "name"; // Updated header
  const airtableImoField = "imo"; // Updated header
  const airtableTypeField = "type"; // Updated header
  const airtableFlagField = "flag"; // Updated header
  const airtableBeamField = "beam"; // Updated header
  const airtableLengthField = "length"; // Updated header
  const airtableDraftField = "draft"; // Updated header
  // Note: 'incident_vessel_id' and 'date_added' from CSV are not directly inserted into cser.vessel
  // 'incident_vessel_id' represents a relationship handled by cser.incident_vessel.vessel_id FK.
  // 'date_added' uses the DEFAULT now() in the cser.vessel table definition.

  try {
    const data = await readCsv(airtableCsvFilename);
    const vesselsToInsert = data
      .map((row) => {
        // Map fields using provided headers
        return {
          name: row[airtableNameField]?.trim() || "UNNAMED", // Handle missing names
          imo: row[airtableImoField]?.trim() || null,
          type: row[airtableTypeField]?.trim() || null,
          flag: row[airtableFlagField]?.trim() || null,
          beam: parseFloat(row[airtableBeamField]) || null, // Parse numbers
          length: parseFloat(row[airtableLengthField]) || null, // Parse numbers
          draft: parseFloat(row[airtableDraftField]) || null, // Parse numbers
        };
      })
      .filter((v) => v.name && v.name !== "UNNAMED"); // Filter out rows without a valid name

    // Handle potential duplicate IMOs before inserting if needed
    // (e.g., create a map of IMO -> vessel data, only keep first encountered)

    // Separate vessels with and without IMO for different insertion strategies
    const vesselsWithImo = vesselsToInsert.filter((v) => v.imo);
    const vesselsWithoutImo = vesselsToInsert.filter((v) => !v.imo);

    let insertedWithImo = [];
    if (vesselsWithImo.length > 0) {
      console.log(`Upserting ${vesselsWithImo.length} vessels with IMO...`);
      // Upsert based on IMO for vessels that have it
      insertedWithImo = await insertData("cser.vessel", vesselsWithImo, 500, {
        onConflict: "imo",
      });
    }

    let insertedWithoutImo = [];
    if (vesselsWithoutImo.length > 0) {
      console.log(
        `Inserting ${vesselsWithoutImo.length} vessels without IMO (duplicates possible if names match)...`
      );
      // Insert vessels without IMO - duplicates might occur if names aren't unique and no other constraint exists
      // Consider adding a unique constraint on 'name' if appropriate, or implement pre-insert duplicate checking by name.
      insertedWithoutImo = await insertData("cser.vessel", vesselsWithoutImo);
    }

    const inserted = [...insertedWithImo, ...insertedWithoutImo];

    // Map Airtable ID to Supabase ID
    // Match based on the inserted data and the original CSV row data
    inserted.forEach((insertedVessel) => {
      // Find the original row that corresponds to this inserted vessel
      // Matching on name and IMO is a reasonable approach, assuming IMO is unique when present
      const originalRow = data.find(
        (row) =>
          (row[airtableNameField]?.trim() || "UNNAMED") ===
            insertedVessel.name &&
          (row[airtableImoField]?.trim() || null) === insertedVessel.imo
      );
      const airtableId = originalRow ? originalRow[airtableIdField] : null;

      if (airtableId) {
        // Add mapping if not already present (handles potential duplicates in source CSV if not filtered before insert)
        if (!mappings.vessel.has(airtableId)) {
          mappings.vessel.set(airtableId, insertedVessel.id);
        } else {
          console.warn(
            `Duplicate Airtable Record ID ${airtableId} found when mapping vessels. Using first encountered Supabase ID.`
          );
        }
      } else {
        console.warn(
          `Could not find original Airtable row for inserted vessel: ${JSON.stringify(insertedVessel)}`
        );
      }
    });
    console.log(`Mapped ${mappings.vessel.size} vessels`);
  } catch (error) {
    console.error(`Failed to migrate vessels:`, error);
    throw error;
  }
}

async function migrateRawData() {
  const airtableCsvFilename = "cser_raw_data.csv"; // Confirmed filename
  const airtableIdField = "record_id"; // Confirmed header

  try {
    const data = await readCsv(airtableCsvFilename);
    const rawDataToInsert = data.map((row) => {
      // Map fields using provided headers from cser_raw_data.csv
      // Basic type conversions included, refine date/json parsing if needed
      const parsedData = {
        title: row["title"]?.trim() || null,
        description: row["description"]?.trim() || null,
        update_text: row["update"]?.trim() || null, // Mapped from 'update'
        date: row["date"] ? new Date(row["date"]).toISOString() : null,
        reference: row["reference"]?.trim() || null,
        region: row["region"]?.trim() || null,
        incident_type_name: row["incident_type_name"]?.trim() || null,
        aggressor: row["aggressor"]?.trim() || null,
        source: row["source"]?.trim() || null,
        latitude: parseFloat(row["latitude"]) || null,
        longitude: parseFloat(row["longitude"]) || null,
        location: row["location"]?.trim() || null,
        raw_json: null, // Placeholder for JSON parsing
        original_source: row["original_source"]?.trim() || null,
        vessel_name: row["vessel_name"]?.trim() || null,
        vessel_type: row["vessel_type"]?.trim() || null,
        vessel_flag: row["vessel_flag"]?.trim() || null,
        vessel_imo: row["vessel_imo"]?.trim() || null,
        vessel_status: row["vessel_status"]?.trim() || null,
        has_incident: ["true", "checked", "1", "yes"].includes(
          row["has_incident"]?.toLowerCase()
        ), // More robust boolean check
        processing_status: row["processing_status"]?.trim() || null, // Ensure value exists in ENUM cser.processing_status_enum
        processing_notes: row["processing_notes"]?.trim() || null,
        last_processed: row["last_processed"]
          ? new Date(row["last_processed"]).toISOString()
          : null,
        processing_attempts: parseInt(row["processing_attempts"], 10) || 0,
        merge_status: row["merge_status"]?.trim() || null, // Ensure value exists in ENUM cser.merge_status_enum
        merged_into_raw_data_id: null, // Requires second pass after mapping all raw_data
        merge_score: row["merge_score"]?.trim() || null,
        airtable_record_id: row[airtableIdField], // Store Airtable ID temporarily
        // created_at and modified_at use DB defaults/triggers
      };

      // Attempt to parse raw_json if it exists and is not empty
      if (row["raw_json"] && row["raw_json"].trim()) {
        try {
          parsedData.raw_json = JSON.parse(row["raw_json"]);
        } catch (e) {
          console.warn(
            `Could not parse raw_json for Airtable record ${row[airtableIdField]}: ${row["raw_json"]}. Error: ${e.message}`
          );
          // Store as text if parsing fails? Or keep null? Keeping null for now.
          // parsedData.raw_json = row["raw_json"];
        }
      }
      return parsedData;
    });

    const inserted = await insertData("cser.raw_data", rawDataToInsert);

    // Map Airtable ID to Supabase ID using the temporary column
    inserted.forEach((insertedRow) => {
      const airtableId = insertedRow.airtable_record_id;
      if (airtableId && insertedRow.id) {
        if (!mappings.rawData.has(airtableId)) {
          mappings.rawData.set(airtableId, insertedRow.id);
        } else {
          console.warn(
            `Duplicate Airtable Record ID ${airtableId} found when mapping raw_data. Using first encountered Supabase ID.`
          );
        }
      } else {
        console.warn(
          `Could not map raw_data row - missing airtable_record_id or inserted id: ${JSON.stringify(insertedRow)}`
        );
      }
    });

    console.log(
      `Mapped ${mappings.rawData.size} raw data entries (initial pass)`
    );
  } catch (error) {
    console.error(`Failed to migrate raw data:`, error);
    throw error;
  }
}

async function migrateIncidents() {
  // This function now only processes NEW incidents from cser_incident.csv

  // --- Process NEW Incidents (cser_incident.csv) ---
  const newIncidentsCsv = "cser_incident.csv"; // Filename confirmed by user
  const newAirtableIdField = "record_id"; // Header confirmed by user

  try {
    const newData = await readCsv(newIncidentsCsv);
    const newIncidentsToInsert = newData
      .map((row) => {
        // Map fields from NEW incident CSV (cser_incident.csv) to Supabase schema
        // reference_id will be generated by trigger
        const dateTime = row["date_time_utc"]
          ? new Date(row["date_time_utc"]).toISOString()
          : null;
        const locationName = row["location_name"]?.trim() || "Unknown Location"; // Ensure location_name is not null for ID generation

        if (!dateTime) {
          console.warn(
            `Skipping row from ${newIncidentsCsv} due to missing date_time_utc: ${row[newAirtableIdField] || JSON.stringify(row)}`
          );
          return null; // Skip rows without a valid date
        }
        if (!locationName) {
          console.warn(
            `Skipping row from ${newIncidentsCsv} due to missing location_name: ${row[newAirtableIdField] || JSON.stringify(row)}`
          );
          return null; // Skip rows without a valid location name
        }

        return {
          // id: is generated by DB (uuid)
          // reference_id: is generated by trigger
          date_time_utc: dateTime,
          latitude: parseFloat(row["latitude"]) || null,
          longitude: parseFloat(row["longitude"]) || null,
          location_name: locationName,
          title: row["title"]?.trim() || null,
          description: row["description"]?.trim() || null,
          analysis: row["analysis"]?.trim() || null,
          recommendations: row["recommendations"]?.trim() || null,
          status: row["status"]?.trim() || null,
          number_of_attackers: parseInt(row["number_of_attackers"], 10) || null,
          region: row["region"]?.trim() || null,
          map_image_url: row["map_image_url"]?.trim() || null,
          // map_image: handled separately if needed
          last_flash_alert_sent_at: row["last_flash_alert_sent_at"]
            ? new Date(row["last_flash_alert_sent_at"]).toISOString()
            : null,
          // hostility & aggressor_legacy_info are null for new incidents
          hostility: null,
          aggressor_legacy_info: null,
          airtable_record_id: row[newAirtableIdField], // Store Airtable ID temporarily
          // date_added, modified_at use DB defaults/triggers
        };
      })
      .filter((inc) => inc !== null); // Filter out skipped rows

    // Upsert incidents based on the reference_id constraint
    console.log(
      `Upserting ${newIncidentsToInsert.length} incidents based on reference_id...`
    );
    const insertedNew = await insertData(
      "cser.incident",
      newIncidentsToInsert,
      500,
      { onConflict: "reference_id" } // Use upsert on reference_id
    );

    // Map Airtable ID to Supabase ID using the temporary column
    insertedNew.forEach((insertedInc) => {
      const airtableId = insertedInc.airtable_record_id;
      if (airtableId && insertedInc.id) {
        if (!mappings.incident.has(airtableId)) {
          mappings.incident.set(airtableId, insertedInc.id);
        } else {
          console.warn(
            `Duplicate Airtable Record ID ${airtableId} encountered while mapping NEW incidents. Check CSV data.`
          );
        }
      } else {
        console.warn(
          `Could not map incident row - missing airtable_record_id or inserted id: ${JSON.stringify(insertedInc)}`
        );
      }
    });
    console.log(`Mapped ${mappings.incident.size} NEW incidents`);
  } catch (error) {
    console.error(`Failed to migrate NEW incidents:`, error);
    throw error;
  }

  /* --- Process OLD Incidents (msm_incidents.csv) ---
  // --- Temporarily Disabled to focus on CSER data first ---
  const oldIncidentsCsv = "msm_incidents.csv"; // Updated filename
  const oldAirtableIdField = "record_id"; // Updated header

  try {
    const oldData = await readCsv(oldIncidentsCsv);
    const oldIncidentsToInsert = oldData
      .map((row) => {
        // Map fields from OLD incident CSV (msm_incidents.csv) to Supabase schema
        const dateTime = row["Date"]
          ? new Date(row["Date"]).toISOString()
          : null; // Using 'Date' header
        const locationName = row["Location"]?.trim() || "Unknown Location"; // Using 'Location', provide default

        if (!dateTime) {
          console.warn(
            `Skipping row from ${oldIncidentsCsv} due to missing Date: ${row[oldAirtableIdField] || JSON.stringify(row)}`
          );
          return null; // Skip rows without a valid date
        }
        if (!locationName) {
          console.warn(
            `Skipping row from ${oldIncidentsCsv} due to missing Location: ${row[oldAirtableIdField] || JSON.stringify(row)}`
          );
          return null; // Skip rows without a valid location name
        }

        return {
          // id: is generated by DB (uuid)
          // reference_id: is generated by trigger
          date_time_utc: dateTime,
          latitude: parseFloat(row["Latitude"]) || null, // Using 'Latitude' header
          longitude: parseFloat(row["Longitude"]) || null, // Using 'Longitude' header
          location_name: locationName,
          title: row["Header"]?.trim() || null, // Using 'Header' header
          description: row["Description Trimmed"]?.trim() || null, // Using 'Description Trimmed' header
          status: row["Status"]?.trim() || null, // Using 'Status' header
          region: row["Region Name"]?.trim() || null, // Using 'Region Name' header
          analysis: row["Analysis"]?.trim() || null, // Using 'Analysis' header
          // recommendations: null, // No direct mapping from old data?
          // number_of_attackers: null, // No direct mapping from old data?
          map_image_url: row["Static Map CDN URL"]?.trim() || null, // Using 'Static Map CDN URL' header
          // last_flash_alert_sent_at: null, // No direct mapping from old data?
          hostility: row["Hostility"]?.trim() || null, // Map legacy field
          aggressor_legacy_info: row["Aggressor Name"]?.trim() || null, // Map legacy field
          // date_added, modified_at use DB defaults/triggers
        };
      })
      .filter((inc) => inc !== null); // Filter out skipped rows

    const insertedOld = await insertData("cser.incident", oldIncidentsToInsert);

    // Map Airtable ID to Supabase ID for OLD incidents
    oldData.forEach((row) => {
      const airtableId = row[oldAirtableIdField];
      // Find corresponding inserted record (needs refinement)
      // Using a combination of fields that are likely unique enough for matching
      const insertedInc = insertedOld.find(
        (i) =>
          i.title === (row["Header"]?.trim() || null) &&
          i.date_time_utc ===
            (row["Date"] ? new Date(row["Date"]).toISOString() : null) &&
          i.latitude === (parseFloat(row["Latitude"]) || null) &&
          i.longitude === (parseFloat(row["Longitude"]) || null)
      );
      if (airtableId && insertedInc) {
        // Avoid overwriting mapping if somehow an old ID matches a new ID (unlikely but possible)
        if (!mappings.incident.has(airtableId)) {
          mappings.incident.set(airtableId, insertedInc.id);
        } else {
          // This case should ideally not happen if Airtable Record IDs are truly unique across bases/time
          console.warn(
            `Duplicate Airtable ID ${airtableId} encountered when mapping OLD incidents. This might indicate an issue.`
          );
        }
      } else {
        console.warn(
          `Could not map old Airtable record ${airtableId} to inserted Supabase incident.`
        );
      }
    });
    // Note: The total count log message might be slightly off when MSM is disabled
    console.log(`Mapped ${mappings.incident.size} TOTAL incidents (new + old)`);
  } catch (error) {
    console.error(`Failed to migrate OLD incidents:`, error);
    // Do not throw error here if only migrating CSER data
    // throw error;
  }
  */ // --- End of Disabled OLD Incidents Processing ---
}

/* --- Temporarily Disabled: Depends on OLD Incidents Data ---
async function migrateIncidentEnvironment() {
  // TODO: Identify the correct CSV filename for OLD incidents (where env data exists)
  const oldIncidentsCsv = "msm_incidents.csv"; // <<< ADJUST THIS - Use the correct old incidents filename
  // TODO: Identify the Airtable Record ID column name
  const oldAirtableIdField = "record_id"; // <<< ADJUST THIS - Use the correct Record ID header

  try {
    const oldData = await readCsv(oldIncidentsCsv);
    const environmentDataToInsert = [];

    for (const row of oldData) {
      const airtableId = row[oldAirtableIdField];
      const supabaseIncidentId = mappings.incident.get(airtableId);

      if (supabaseIncidentId) {
        // Extract environmental fields based on CSV headers provided earlier
        const envData = {
          incident_id: supabaseIncidentId,
          sea_state: row["Sea State"]?.trim() || null,
          visibility: row["Visibility"]?.trim() || null,
          moon_details: row["Moon"]?.trim() || null,
          moon_fraction: parseFloat(row["Moon Fraction"]) || null,
          sun_details: row["Sun"]?.trim() || null,
          wave_details: row["Wave"]?.trim() || null,
          wind_details: row["Wind"]?.trim() || null,
        };
        // Only add if at least one env field has data
        if (
          Object.values(envData).some(
            (v) => v !== null && v !== supabaseIncidentId
          )
        ) {
          environmentDataToInsert.push(envData);
        }
      } else {
        // Only log if the airtableId was actually present in the CSV row
        if (airtableId) {
          console.warn(
            `Skipping environment data for old incident with Airtable ID ${airtableId} because it wasn't mapped to a Supabase ID.`
          );
        }
      }
    }

    await insertData("cser.incident_environment", environmentDataToInsert);
  } catch (error) {
    console.error(`Failed to migrate incident environment data:`, error);
    // Do not throw error here if only migrating CSER data
    // throw error;
  }
}
*/ // --- End of Disabled Incident Environment Migration ---

async function migrateJunctionTable(
  airtableCsvFilename,
  airtableIdField,
  airtableLinkField,
  supabaseJunctionTable,
  supabaseIncidentIdField,
  supabaseLookupIdField,
  lookupMap,
  lookupByKey = "id" // 'id' for record IDs, 'name' for lookup tables
) {
  // This function handles generic junction table migrations based on linked IDs/Names in the source CSV.

  console.log(
    `Migrating junction table ${supabaseJunctionTable} using ${airtableCsvFilename}...`
  );
  try {
    const data = await readCsv(airtableCsvFilename);
    const linksToInsert = [];

    for (const row of data) {
      const sourceAirtableId = row[airtableIdField];
      // Determine the correct source mapping based on the source CSV
      let sourceSupabaseId;
      if (airtableCsvFilename.includes("incident")) {
        sourceSupabaseId = mappings.incident.get(sourceAirtableId);
      } // Add else if for other potential source tables if needed

      if (!sourceSupabaseId) {
        // console.warn(`Skipping junction links for ${airtableCsvFilename} row ${sourceAirtableId}: Source record not mapped.`);
        continue;
      }

      // Handle potentially comma-separated linked values
      const linkedValues = (row[airtableLinkField] || "")
        .split(",")
        .map((val) => val.trim())
        .filter((val) => val);

      for (const linkedValue of linkedValues) {
        let targetSupabaseId;
        if (lookupByKey === "id") {
          // Airtable linked record fields are arrays, even if single link. Get the first ID.
          const targetAirtableId = Array.isArray(linkedValue)
            ? linkedValue[0]?.trim()
            : linkedValue?.trim();
          targetSupabaseId = lookupMap.get(targetAirtableId); // Lookup by Airtable Record ID
        } else if (lookupByKey === "name") {
          targetSupabaseId = lookupMap.get(linkedValue); // Lookup by Name
        }

        if (targetSupabaseId) {
          linksToInsert.push({
            [supabaseIncidentIdField]: sourceSupabaseId, // Assuming the 'left' side is always incident_id for these links
            [supabaseLookupIdField]: targetSupabaseId,
          });
        } else {
          // console.warn(`Could not find Supabase mapping for linked value '${linkedValue}' (lookup key: ${lookupByKey}) from ${airtableCsvFilename} row ${sourceAirtableId}`); // Original warning
          // More detailed warning:
          console.warn(
            `[${supabaseJunctionTable}] Failed lookup for value "${linkedValue}" (expected key type: ${lookupByKey}) in field "${airtableLinkField}" of source row ID ${sourceAirtableId} from ${airtableCsvFilename}. No link created.`
          );
        }
      }
    }

    if (linksToInsert.length > 0) {
      // Remove potential duplicates before inserting
      const uniqueLinks = Array.from(
        new Map(
          linksToInsert.map((item) => [
            `${item[supabaseIncidentIdField]}-${item[supabaseLookupIdField]}`,
            item,
          ])
        ).values()
      );
      await insertData(supabaseJunctionTable, uniqueLinks);
    } else {
      console.log(
        `No junction links to insert for ${supabaseJunctionTable} from ${airtableCsvFilename}.`
      );
    }
  } catch (error) {
    console.error(
      `Failed to migrate junction table ${supabaseJunctionTable} from ${airtableCsvFilename}:`,
      error
    );
    // Decide whether to throw or just log and continue
    // throw error;
  }
}

async function migrateIncidentVesselJunction() {
  const airtableCsvFilename = "cser_incident_vessel.csv"; // The dedicated junction table export
  const supabaseJunctionTable = "cser.incident_vessel";
  // Use the correct headers containing Airtable Record IDs
  const airtableIncidentLinkField = "incident_id_record_id"; // Updated header for Incident Record ID
  const airtableVesselLinkField = "vessel_id_record_id"; // Updated header for Vessel Record ID
  const supabaseIncidentIdField = "incident_id";
  const supabaseVesselIdField = "vessel_id";

  console.log(
    `\n--- Migrating Incident-Vessel Links (${supabaseJunctionTable}) ---`
  );
  try {
    const data = await readCsv(airtableCsvFilename);
    const linksToInsert = [];

    for (const row of data) {
      // Get the Airtable Record IDs from the link columns
      // Airtable linked record fields are arrays, even if single link. Get the first ID.
      const incidentAirtableId = Array.isArray(row[airtableIncidentLinkField])
        ? row[airtableIncidentLinkField][0]?.trim()
        : row[airtableIncidentLinkField]?.trim();
      const vesselAirtableId = Array.isArray(row[airtableVesselLinkField])
        ? row[airtableVesselLinkField][0]?.trim()
        : row[airtableVesselLinkField]?.trim();

      if (!incidentAirtableId || !vesselAirtableId) {
        // console.warn(`Skipping row in ${airtableCsvFilename}: Missing incident or vessel link.`);
        continue;
      }

      // Look up the corresponding Supabase UUIDs using the mappings
      const supabaseIncidentId = mappings.incident.get(incidentAirtableId);
      const supabaseVesselId = mappings.vessel.get(vesselAirtableId);

      if (supabaseIncidentId && supabaseVesselId) {
        linksToInsert.push({
          [supabaseIncidentIdField]: supabaseIncidentId,
          [supabaseVesselIdField]: supabaseVesselId,
          // TODO: Add other fields from cser_incident_vessel if needed in Supabase table
          // e.g., vessel_status_during_incident: row['vessel_status_during_incident']?.trim() || null,
        });
      } else {
        if (!supabaseIncidentId) {
          // console.warn(`Incident-Vessel Link: Could not find Supabase mapping for Incident Airtable ID ${incidentAirtableId}`);
        }
        if (!supabaseVesselId) {
          // console.warn(`Incident-Vessel Link: Could not find Supabase mapping for Vessel Airtable ID ${vesselAirtableId}`);
        }
      }
    }

    if (linksToInsert.length > 0) {
      // Remove potential duplicates before inserting
      const uniqueLinks = Array.from(
        new Map(
          linksToInsert.map((item) => [
            `${item[supabaseIncidentIdField]}-${item[supabaseVesselIdField]}`,
            item,
          ])
        ).values()
      );
      await insertData(supabaseJunctionTable, uniqueLinks);
    } else {
      console.log(
        `No valid incident-vessel links found to insert from ${airtableCsvFilename}.`
      );
    }
  } catch (error) {
    console.error(
      `Failed to migrate ${supabaseJunctionTable} from ${airtableCsvFilename}:`,
      error
    );
    // Decide whether to throw or just log and continue
    // throw error;
  }
}

async function updateRawDataMergeLinks() {
  const airtableCsvFilename = "cser_raw_data.csv";
  const airtableIdField = "record_id";
  const airtableMergeLinkField = "merged_into"; // Confirmed header from documentation analysis
  const supabaseTableName = "cser.raw_data";
  const supabaseIdField = "id";
  const supabaseMergeLinkField = "merged_into_raw_data_id";

  console.log(
    `\n--- Updating Raw Data Merge Links (${supabaseMergeLinkField}) ---`
  );

  try {
    const data = await readCsv(airtableCsvFilename);
    const updates = [];

    for (const row of data) {
      const sourceAirtableId = row[airtableIdField];
      // Airtable linked record fields are arrays, even if single link. Get the first ID.
      const targetAirtableId = Array.isArray(row[airtableMergeLinkField])
        ? row[airtableMergeLinkField][0]?.trim()
        : row[airtableMergeLinkField]?.trim();

      if (!sourceAirtableId || !targetAirtableId) {
        continue; // Skip if no source or target ID
      }

      const sourceSupabaseId = mappings.rawData.get(sourceAirtableId);
      const targetSupabaseId = mappings.rawData.get(targetAirtableId);

      if (sourceSupabaseId && targetSupabaseId) {
        updates.push({
          [supabaseIdField]: sourceSupabaseId,
          [supabaseMergeLinkField]: targetSupabaseId,
        });
      } else {
        if (!sourceSupabaseId) {
          // console.warn(`Raw Data Merge Update: Could not find Supabase ID for source Airtable ID ${sourceAirtableId}`);
        }
        if (!targetSupabaseId) {
          // console.warn(`Raw Data Merge Update: Could not find Supabase ID for target Airtable ID ${targetAirtableId} (linked from ${sourceAirtableId})`);
        }
      }
    }

    if (updates.length === 0) {
      console.log("No raw_data merge links found to update.");
      return;
    }

    console.log(
      `Attempting to update ${updates.length} raw_data merge links...`
    );
    let updatedCount = 0;
    // Update records one by one or in smaller batches for potentially large updates
    // Using individual updates here for simplicity, batching could be added for performance
    for (const update of updates) {
      const { error } = await supabase
        .from(supabaseTableName.split(".")[1]) // Extract table name
        // Removed incorrect .schema() call; 'cser' is now in the DB role's search_path
        .update({ [supabaseMergeLinkField]: update[supabaseMergeLinkField] })
        .eq(supabaseIdField, update[supabaseIdField]);

      if (error) {
        console.error(
          `Error updating ${supabaseTableName} record ${update[supabaseIdField]} with merge link ${update[supabaseMergeLinkField]}:`,
          error.message
        );
      } else {
        updatedCount++;
      }
    }
    console.log(
      `Successfully updated ${updatedCount} out of ${updates.length} raw_data merge links.`
    );
  } catch (error) {
    console.error(`Failed to update raw data merge links:`, error);
    // Decide whether to throw or just log and continue
    // throw error;
  }
}

// --- Main Execution ---
async function runMigration() {
  console.log(
    "Starting CSER Airtable to Supabase migration (MSM data temporarily disabled)..."
  );

  try {
    // 1. Migrate Lookup Tables (CSER only)
    console.log("\n--- Migrating Lookup Tables ---");
    await migrateLookupTable(
      "cser_incident_type.csv",
      "cser.incident_type",
      "incidentType"
    );
    await migrateLookupTable("cser_weapons_used.csv", "cser.weapon", "weapon");
    await migrateLookupTable(
      "cser_items_stolen.csv",
      "cser.item_stolen",
      "itemStolen"
    );
    await migrateLookupTable(
      "cser_response_type.csv",
      "cser.response_type",
      "responseType"
    );
    await migrateLookupTable(
      "cser_authorities_notified.csv",
      "cser.authority",
      "authority"
    );

    // 2. Migrate Vessels (CSER only)
    console.log("\n--- Migrating Vessels ---");
    await migrateVessels(); // Uses cser_vessel.csv

    // 3. Migrate Raw Data (CSER only)
    console.log("\n--- Migrating Raw Data ---");
    await migrateRawData(); // Uses cser_raw_data.csv

    // 4. Migrate Incidents (CSER only for now)
    console.log("\n--- Migrating Incidents (CSER only) ---");
    await migrateIncidents(); // Uses cser_incident.csv (MSM part is commented out inside)

    // 5. Migrate Incident Environment Data (from Old Incidents) - Temporarily Disabled
    // console.log("\n--- Migrating Incident Environment Data ---");
    // await migrateIncidentEnvironment(); // Uses msm_incidents.csv internally

    // 6. Migrate Incident-Vessel Junction Table (from dedicated CSV) - CSER Only
    // This must run after incidents and vessels are mapped
    await migrateIncidentVesselJunction(); // Uses cser_incident_vessel.csv internally

    // 7. Migrate Other Junction Tables (Requires incident and lookup mappings) - CSER Only
    console.log("\n--- Migrating Other Junction Tables (CSER only) ---");

    // From cser_incident.csv (using migrateJunctionTable helper)
    await migrateJunctionTable(
      "cser_incident.csv",
      "record_id",
      "incident_type_name",
      "cser.incident_incident_type_link",
      "incident_id",
      "incident_type_id",
      mappings.incidentType,
      "name"
    );
    await migrateJunctionTable(
      "cser_incident.csv",
      "record_id",
      "weapons_used",
      "cser.incident_weapon_link",
      "incident_id",
      "weapon_id",
      mappings.weapon,
      "name"
    );
    await migrateJunctionTable(
      "cser_incident.csv",
      "record_id",
      "items_stolen",
      "cser.incident_item_stolen_link",
      "incident_id",
      "item_stolen_id",
      mappings.itemStolen,
      "name"
    );
    await migrateJunctionTable(
      "cser_incident.csv",
      "record_id",
      "response_type",
      "cser.incident_response_type_link",
      "incident_id",
      "response_type_id",
      mappings.responseType,
      "name"
    );
    await migrateJunctionTable(
      "cser_incident.csv",
      "record_id",
      "authorities_notified",
      "cser.incident_authority_link",
      "incident_id",
      "authority_id",
      mappings.authority,
      "name"
    );
    await migrateJunctionTable(
      "cser_incident.csv",
      "record_id",
      "raw_data_record_id", // Use the new column with actual IDs
      "cser.incident_raw_data_link",
      "incident_id",
      "raw_data_id",
      mappings.rawData,
      "id"
    ); // Assuming 'raw_data' contains Raw Data Record IDs

    // From msm_incidents.csv - Temporarily Disabled
    // Using 'Record ID' as the Airtable ID field and 'Type Name' as the link field (lookup by name)
    // await migrateJunctionTable('msm_incidents.csv', 'Record ID', 'Type Name', 'cser.incident_incident_type_link', 'incident_id', 'incident_type_id', mappings.incidentType, 'name');
    // No other linked fields confirmed for msm_incidents.csv

    // 8. Update Raw Data Merge Links (Second Pass) - CSER Only
    // This must run after all raw_data has been inserted and mapped
    await updateRawDataMergeLinks();

    console.log("\nMigration script finished.");
    console.log("IMPORTANT: Review console logs for errors or warnings.");
    console.log("IMPORTANT: Manually verify data in Supabase.");
  } catch (error) {
    console.error("MIGRATION FAILED:", error);
    process.exit(1);
  }
}

runMigration();
