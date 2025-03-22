import crypto from "crypto";

/**
 * Generates an MD5 hash of the provided string data
 * 
 * @param {string} data - The string content to hash
 * @returns {string} The MD5 hash of the input data as a hexadecimal string
 * @throws {TypeError} If data is not a string
 */
export function generateHash(data) {
  if (typeof data !== "string") {
    throw new TypeError("Data must be a string");
  }
  return crypto.createHash("md5").update(data).digest("hex");
}
