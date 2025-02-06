import axios from "axios";
import { log } from "./logger.js";

class AirtableClient {
  constructor(apiKey, retryOptions = {}) {
    this.apiKey = apiKey;
    this.retryOptions = {
      maxRetries: retryOptions.maxRetries || 3,
      initialDelay: retryOptions.initialDelay || 1000,
      maxDelay: retryOptions.maxDelay || 5000,
    };
  }

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
