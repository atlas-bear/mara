import { load } from "cheerio"; // Import cheerio

export const parseCwdHtmlContent = (html, log) => {
  const $ = load(html);
  const incidents = [];

  $("#features").each((_, featureSection) => {
    const section = $(featureSection);

    // Parse each incident's information
    const incident = {
      title: section.find("h6").first().text().trim(),
    };

    // Initialize a variable to hold description text
    let description = "";

    // Loop through table rows and parse incident details
    const tableRows = section.find("table tr");
    tableRows.each((index, row) => {
      const cells = $(row).find("td, th");

      // Skip rows with <i> tags (probably metadata or non-incident related rows)
      if ($(row).find("i").length > 0) return;

      if (cells.length === 6 && !$(cells.first()).attr("colspan")) {
        incident.date = processDate($(cells[0]).text().trim());
        incident.reference = processText($(cells[1]).text().trim(), true);
        incident.region = processText($(cells[2]).text().trim());
        incident.category = processText($(cells[3]).text().trim());
        incident.aggressors = processText($(cells[4]).text().trim());
        incident.source = processText($(cells[5]).text().trim());
      }

      // Handle the description (usually spans multiple rows)
      if (cells.length === 1 && $(cells).attr("colspan") === "6") {
        description = $(cells).text().trim();
      }
    });

    // Parse updates in the description (if any)
    const updateRegex =
      /\b(UPDATE\s*\d*:?|Update\s*\d*:?)\s*(.*?)(?=\b(UPDATE\s*\d*:?|Update\s*\d*:?)|$)/gis;
    let updates = [];
    let match;

    while ((match = updateRegex.exec(description)) !== null) {
      const updatePrefix = match[1].trim();
      const updateText = match[2].trim();

      if (updateText) {
        updates.push({
          prefix: updatePrefix,
          text: updateText,
        });
      }
    }

    // Organize description and updates
    if (updates.length > 0) {
      incident.description = description
        .slice(0, description.indexOf(updates[0].prefix))
        .trim();
      incident.update = updates
        .map((update) => `${update.prefix} ${update.text}`)
        .join("\n\n");
    } else {
      incident.description = description.trim();
      incident.update = null;
    }

    // Extract coordinates (if available)
    const coordinates = extractCoordinates($, section);
    if (Object.keys(coordinates).length > 0) {
      incident.latitude = coordinates.latitude;
      incident.longitude = coordinates.longitude;
    }

    // Only add valid incidents with a title and description
    if (incident.title && incident.description) {
      incidents.push(incident);
    }
  });

  log.info("Parsed incidents", { count: incidents.length });
  return incidents;
};

// Helper functions for processing
function processDate(dateString) {
  let date = new Date(dateString);

  if (isNaN(date.getTime())) {
    const parts = dateString.match(
      /(\d{1,2})\s+(\w{3})\s+(\d{4})\s*-?\s*(\d{2}):(\d{2})/
    );
    if (parts) {
      const [_, day, month, year, hour, minute] = parts;
      const monthIndex = [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ].indexOf(month.toLowerCase());
      if (monthIndex !== -1) {
        date = new Date(year, monthIndex, day, hour, minute);
      }
    }
  }

  if (isNaN(date.getTime())) {
    return dateString; // Return original string if date parsing fails
  }

  // Normalize to a standard ISO date without seconds and milliseconds
  const isoString = date.toISOString();
  return isoString.slice(0, 16) + ":00.000Z";
}

function processText(text, removeSpaces = false) {
  if (!text) return null;
  let processed = text
    .toLowerCase()
    .replace(/[.,\-]/g, "")
    .replace(/\//g, ",");
  if (removeSpaces) {
    processed = processed.replace(/[\s()]/g, "");
  }
  return processed;
}

// Function to extract coordinates from embedded scripts (if present)
function extractCoordinates($, section) {
  const coordinates = {};
  section.find("script").each((_, element) => {
    const scriptContent = $(element).html();
    if (scriptContent && scriptContent.includes("map.setView")) {
      const match = scriptContent.match(/setView\(\[([-\d.]+),\s*([-\d.]+)\]/);
      if (match) {
        coordinates.latitude = parseFloat(match[1]);
        coordinates.longitude = parseFloat(match[2]);
      }
    }
  });
  return coordinates;
}
