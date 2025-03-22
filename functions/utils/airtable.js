import axios from "axios";
import { log } from "./logger.js";

/**
 * Client for interacting with the Airtable API
 * 
 * Provides methods for fetching, creating, updating, and deleting records
 * with built-in pagination and retry capabilities
 */
class AirtableClient {
  /**
   * Creates a new AirtableClient instance
   * 
   * @param {string} apiKey - Airtable API key
   * @param {Object} [retryOptions={}] - Options for request retry behavior
   * @param {number} [retryOptions.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [retryOptions.initialDelay=1000] - Initial delay between retries in ms
   * @param {number} [retryOptions.maxDelay=5000] - Maximum delay between retries in ms
   */
  constructor(apiKey, retryOptions = {}) {
    this.apiKey = apiKey;
    this.retryOptions = {
      maxRetries: retryOptions.maxRetries || 3,
      initialDelay: retryOptions.initialDelay || 1000,
      maxDelay: retryOptions.maxDelay || 5000,
    };
  }

  /**
   * Fetches records from an Airtable table with pagination and retry support
   * 
   * @param {string} baseId - Airtable base ID
   * @param {string} tableName - Name of the table to fetch from
   * @param {Object} [options={}] - Query options
   * @param {Array<string>} [options.fields] - Fields to return (all fields if not specified)
   * @param {string} [options.filterByFormula] - Airtable formula to filter records
   * @param {number} [options.maxRecords] - Maximum number of records to return
   * @param {Array<Object>} [options.sort] - Sort specifications
   * @param {string} [options.view] - Name of view to use
   * @returns {Promise<Array<Object>>} Array of record objects
   * @throws {Error} If fetch fails after all retry attempts
   */
  async fetchRecords(baseId, tableName, options = {}) {
    const { fields, filterByFormula, maxRecords, sort, view } = options;

    let allRecords = [];
    let offset = null;
    let attempts = 0;

    do {
      try {
        const response = await this._makeRequest(baseId, tableName, {
          fields,
          filterByFormula,
          maxRecords,
          sort,
          view,
          offset,
        });

        allRecords = allRecords.concat(response.records);
        offset = response.offset;
      } catch (error) {
        attempts++;
        if (attempts >= this.retryOptions.maxRetries) {
          throw error;
        }

        const delay = Math.min(
          this.retryOptions.initialDelay * Math.pow(2, attempts),
          this.retryOptions.maxDelay
        );

        log.info(`Retrying Airtable request after ${delay}ms`, {
          attempt: attempts,
          tableName,
          error: error.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } while (offset);

    return allRecords;
  }

  /**
   * Creates new records in an Airtable table
   * 
   * @param {string} baseId - Airtable base ID
   * @param {string} tableName - Name of the table to create records in
   * @param {Array<Object>} records - Array of record objects to create
   * @param {Object} [options={}] - Creation options
   * @param {boolean} [options.typecast=false] - Whether to typecast values to match field types
   * @returns {Promise<Object>} Airtable response containing created records
   * @throws {Error} If creation fails
   */
  async createRecords(baseId, tableName, records, options = {}) {
    const { typecast = false } = options;

    try {
      const response = await axios({
        method: "post",
        url: `https://api.airtable.com/v0/${baseId}/${tableName}`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        data: {
          records,
          typecast,
        },
      });

      return response.data;
    } catch (error) {
      log.error("Error creating Airtable records", error);
      throw error;
    }
  }

  /**
   * Updates existing records in an Airtable table
   * 
   * @param {string} baseId - Airtable base ID
   * @param {string} tableName - Name of the table to update records in
   * @param {Array<Object>} records - Array of record objects to update (must include id property)
   * @param {Object} [options={}] - Update options
   * @param {boolean} [options.typecast=false] - Whether to typecast values to match field types
   * @returns {Promise<Object>} Airtable response containing updated records
   * @throws {Error} If update fails
   */
  async updateRecords(baseId, tableName, records, options = {}) {
    const { typecast = false } = options;

    try {
      const response = await axios({
        method: "patch",
        url: `https://api.airtable.com/v0/${baseId}/${tableName}`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        data: {
          records,
          typecast,
        },
      });

      return response.data;
    } catch (error) {
      log.error("Error updating Airtable records", error);
      throw error;
    }
  }

  /**
   * Deletes records from an Airtable table
   * 
   * @param {string} baseId - Airtable base ID
   * @param {string} tableName - Name of the table to delete records from
   * @param {Array<string>} recordIds - Array of record IDs to delete
   * @returns {Promise<Object>} Airtable response containing deletion results
   * @throws {Error} If deletion fails
   */
  async deleteRecords(baseId, tableName, recordIds) {
    try {
      const response = await axios({
        method: "delete",
        url: `https://api.airtable.com/v0/${baseId}/${tableName}`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        params: {
          records: recordIds,
        },
      });

      return response.data;
    } catch (error) {
      log.error("Error deleting Airtable records", error);
      throw error;
    }
  }

  /**
   * Makes a request to the Airtable API
   * 
   * @param {string} baseId - Airtable base ID
   * @param {string} tableName - Name of the table to query
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Airtable API response
   * @private
   */
  async _makeRequest(baseId, tableName, params) {
    const response = await axios({
      method: "get",
      url: `https://api.airtable.com/v0/${baseId}/${tableName}`,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      params: {
        ...params,
        returnFieldsByFieldId: false,
      },
    });

    return response.data;
  }
}

// Export a singleton instance
export const airtableClient = new AirtableClient(process.env.AT_API_KEY);
