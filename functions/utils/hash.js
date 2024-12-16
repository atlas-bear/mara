const crypto = require("crypto");

// Function to generate a hash of the data (HTML content)
export function generateHash(data) {
  if (typeof data !== "string") {
    throw new TypeError("Data must be a string");
  }
  return crypto.createHash("md5").update(data).digest("hex");
}
