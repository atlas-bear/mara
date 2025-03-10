import { airtableClient } from "./airtable.js";
import { cacheOps } from "./cache.js";
import { log } from "./logger.js";

// Cache keys for different reference data types
const CACHE_KEYS = {
  VESSEL_TYPES: "reference-vessel-types",
  MARITIME_REGIONS: "reference-maritime-regions",
  INCIDENT_TYPES: "reference-incident-types",
  // Add more reference data types as needed
};

// Cache duration (24 hours in milliseconds)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

class ReferenceDataManager {
  constructor() {
    this.baseId = process.env.AT_BASE_ID_GIDA;
  }

  async getVesselTypes() {
    return this._getReferenceData(
      CACHE_KEYS.VESSEL_TYPES,
      "vessel_type",
      (record) => ({
        id: record.id,
        name: record.fields.name.toLowerCase(),
      })
    );
  }

  async getMaritimeRegions() {
    return this._getReferenceData(
      CACHE_KEYS.MARITIME_REGIONS,
      "maritime_region",
      (record) => ({
        id: record.id,
        name: record.fields.name,
        bounds: {
          lat: {
            min: record.fields.lat_min,
            max: record.fields.lat_max,
          },
          lng: {
            min: record.fields.lng_min,
            max: record.fields.lng_max,
          },
        },
      })
    );
  }

  async getIncidentTypes() {
    return this._getReferenceData(
      CACHE_KEYS.INCIDENT_TYPES,
      "incident_type",
      (record) => ({
        id: record.id,
        name: record.fields.name,
      }),
      process.env.AT_BASE_ID_CSER // Use CSER base for incident types
    );
  }

  async getAllReferenceData() {
    try {
      const [vesselTypes, maritimeRegions, incidentTypes] = await Promise.all([
        this.getVesselTypes(),
        this.getMaritimeRegions(),
        this.getIncidentTypes(),
      ]);

      return {
        vesselTypes,
        maritimeRegions,
        incidentTypes,
      };
    } catch (error) {
      log.error("Error fetching all reference data", error);
      throw error;
    }
  }

  async _getReferenceData(
    cacheKey,
    tableName,
    transformFn,
    baseId = this.baseId
  ) {
    try {
      // Check cache first
      const cachedData = await cacheOps.get(cacheKey);
      if (cachedData && !this._isStale(cachedData.timestamp)) {
        return cachedData.data;
      }

      // Fetch fresh data if cache miss or stale
      const records = await airtableClient.fetchRecords(baseId, tableName);
      const transformedData = records.map(transformFn);

      // Update cache
      await cacheOps.store(cacheKey, {
        data: transformedData,
        timestamp: new Date().toISOString(),
      });

      return transformedData;
    } catch (error) {
      log.error("Error fetching reference data", {
        cacheKey,
        tableName,
        error: error.message,
      });
      throw error;
    }
  }

  _isStale(timestamp) {
    return new Date() - new Date(timestamp) > CACHE_DURATION;
  }

  // Helper methods for finding specific reference data
  findVesselType(name) {
    return this.getVesselTypes().then((types) =>
      types.find((type) => name.toLowerCase().includes(type.name))
    );
  }

  findRegionByCoordinates(lat, lng) {
    return this.getMaritimeRegions().then((regions) => {
      log.info("Checking coordinates against regions", { lat, lng });

      for (const region of regions) {
        const bounds = region.bounds;
        const matches =
          lat >= bounds.lat.min &&
          lat <= bounds.lat.max &&
          lng >= bounds.lng.min &&
          lng <= bounds.lng.max;

        log.info("Region check", {
          region: region.name,
          bounds,
          matches,
          checks: {
            lat: `${bounds.lat.min} <= ${lat} <= ${bounds.lat.max}`,
            lng: `${bounds.lng.min} <= ${lng} <= ${bounds.lng.max}`,
          },
        });

        if (matches) return region;
      }
      return null;
    });
  }

  findIncidentType(description) {
    return this.getIncidentTypes().then((types) =>
      types.find((type) =>
        description.toLowerCase().includes(type.name.toLowerCase())
      )
    );
  }
}

// Export a singleton instance
export const referenceData = new ReferenceDataManager();
