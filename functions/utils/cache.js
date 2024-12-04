import crypto from "crypto";

export const cacheOps = {
  generateHash: (content) =>
    crypto.createHash("md5").update(content).digest("hex"),
  // Add store and get implementations based on your preferred caching solution (e.g., Redis, local file storage)
};
