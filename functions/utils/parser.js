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

    let description = "";

    const tableRows = section.find("table tr");
    tableRows.each((index, row) => {
      const cells = $(row).find("td, th");

      if ($(row).find("i").length > 0) return;

      if (cells.length === 6 && !$(cells.first()).attr("colspan")) {
        incident.date = processDate($(cells[0]).text().trim());
        // Removed undefined processText call, using trimmed text directly
        incident.reference = $(cells[1]).text().trim();
        incident.region = $(cells[2]).text().trim();
        incident.category = $(cells[3]).text().trim();
        incident.aggressors = $(cells[4]).text().trim();
        incident.source = $(cells[5]).text().trim();
      }

      if (cells.length === 1 && $(cells).attr("colspan") === "6") {
        description = $(cells).text().trim();
      }
    });

    // Normalize description to remove unnecessary dynamic elements
    description = description.replace(/last updated:.*$/i, "").trim();

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

    if (updates.length > 0) {
      incident.description = description
        .slice(0, description.indexOf(updates[0].prefix))
        .trim();
      incident.update = updates
        .map((update) => `${update.prefix} ${update.text}`)
        .join("\n\n");
    } else {
      incident.description = description.trim();
      incident.update = null; // Ensure consistent null value if no updates
    }

    const coordinates = extractCoordinates($, section);
    if (Object.keys(coordinates).length > 0) {
      incident.latitude = coordinates.latitude;
      incident.longitude = coordinates.longitude;
    }

    if (incident.title && incident.description) {
      incidents.push(incident);
    }
  });

  log.info("Parsed incidents", { count: incidents.length });
  return incidents;
};

// Helper functions to process text and date fields

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
    return dateString;
  }

  return date.toISOString().slice(0, 10); // Return only the date in YYYY-MM-DD format
}
