import https from "https";

import { fetchHtmlContent } from "./utils/fetch.js";
import { parseCwdHtmlContent } from "./utils/parser.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { log } from "./utils/logger.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import { cacheOps } from "./utils/cache.js";
import { generateHash } from "./utils/hash.js";

export const handler = async (event, context) => {
  // Verify required environment variables
  verifyEnvironmentVariables([
    "BRD_HOST",
    "BRD_PORT",
    "BRD_USER",
    "BRD_PASSWORD",
  ]);

  const proxyConfig = {
    proxy: {
      host: process.env.BRD_HOST,
      port: process.env.BRD_PORT,
      auth: {
        username: process.env.BRD_USER,
        password: process.env.BRD_PASSWORD,
      },
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 5000,
  };

  const url = process.env.SOURCE_URL_CWD;
  const cacheKey = "cwd-incidents"; // Cache key for incidents

  try {
    log.info("Fetching content from:", url);
    const htmlContent = await fetchHtmlContent(url, proxyConfig, log);

    // Parse raw incidents
    const rawIncidents = parseCwdHtmlContent(htmlContent, log);

    // Standardize incidents for downstream processing
    const standardizedIncidents = rawIncidents.map((incident) =>
      standardizeIncident(incident, "Clearwater Dynamics", url)
    );

    // Serialize only relevant fields for hashing
    const hashableIncidents = standardizedIncidents.map(
      ({ title, description, date, reference, region, category }) => ({
        title,
        description,
        date,
        reference,
        region,
        category,
      })
    );
    const serializedData = JSON.stringify(hashableIncidents);
    log.info("Serialized data for hash:", serializedData);

    // Generate new hash based on serialized data
    const newHash = generateHash(serializedData);
    log.info("Generated new hash:", newHash); // Log the newly generated hash

    // Retrieve cached data
    const cachedData = await cacheOps.get(cacheKey);
    if (cachedData) {
      const cachedHash = cachedData.hash;
      log.info("Cached hash:", cachedHash); // Log the cached hash

      // Compare hashes to determine if the data has changed
      if (newHash === cachedHash) {
        log.info("Hashes match: No new data detected."); // Log when hashes match
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Collection successful (from cache)",
            incidents: cachedData.incidents,
          }),
        };
      }
    }

    // If hashes differ, store the new data and hash in the cache
    log.info("New data detected: parsing and standardizing incidents", {
      cacheKey,
    });
    await cacheOps.store(cacheKey, {
      incidents: standardizedIncidents,
      hash: newHash,
    });
    log.info("Data stored in cache", { cacheKey });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Collection successful",
        incidents: standardizedIncidents,
      }),
    };
  } catch (error) {
    log.error("CWD incident collection failed", error);
    return {
      statusCode: 500,
      body: "Error during collection",
    };
  }
};
