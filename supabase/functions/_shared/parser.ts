/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

// Import the Deno DOM parser
// Make sure to add this to import_map.json if managing dependencies there
import { DOMParser, Element, Node } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts'; // Add Node import
import { log } from './logger.ts';

// Helper function to process date strings (ported from original)
function processDate(dateString: string): string | null {
  // Try standard parsing first
  let date = new Date(dateString);

  // If standard parsing fails, try the custom format "DD MMM YYYY - HH:MM"
  if (isNaN(date.getTime())) {
    const parts = dateString.match(
      /(\d{1,2})\s+(\w{3})\s+(\d{4})\s*-?\s*(\d{2}):(\d{2})/
    );
    if (parts) {
      const [_, day, monthAbbr, year, hour, minute] = parts;
      const monthIndex = [
        'jan', 'feb', 'mar', 'apr', 'may', 'jun',
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
      ].indexOf(monthAbbr.toLowerCase());
      if (monthIndex !== -1) {
        // Construct date in UTC to avoid timezone issues if possible,
        // but source format implies local time without offset. Assume local for now.
        // Consider refining this if timezone is critical.
        date = new Date(parseInt(year), monthIndex, parseInt(day), parseInt(hour), parseInt(minute));
      }
    }
  }

  // If still invalid, return null or original string? Returning null for consistency.
  if (isNaN(date.getTime())) {
    log.warn('Failed to parse date string', { dateString });
    return null;
  }

  // Return date as ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
  return date.toISOString();
}

// Ported function to parse CWD HTML content using deno-dom
// deno-lint-ignore no-explicit-any
export function parseCwdHtmlContent(html: string, sourceName: string): any[] {
  const incidents: any[] = [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      throw new Error('Failed to parse HTML content');
    }

    // Select all feature sections (assuming #features is the correct top-level ID)
    // Use querySelectorAll which returns NodeListOf<Element>
    const featureSections = doc.querySelectorAll('#features');

    featureSections.forEach((featureSectionNode: Node) => { // Explicitly type Node
        // Ensure it's an Element node before casting
        if (!(featureSectionNode instanceof Element)) return;
        const featureSection = featureSectionNode; // No need to cast if already checked

        // Find the title (assuming it's the first h6)
        const titleElement = featureSection.querySelector('h6');
        const title = titleElement?.textContent?.trim() || '';

        const incident: Record<string, any> = { title };
        let description = '';
        let updates: { prefix: string; text: string }[] = [];

        // Find the table within the section
        const table = featureSection.querySelector('table');
        if (table) {
            const tableRows = table.querySelectorAll('tr');
            tableRows.forEach((rowNode: Node) => { // Explicitly type Node
                if (!(rowNode instanceof Element)) return;
                const row = rowNode; // No need to cast

                // Skip rows with icons (like in original)
                if (row.querySelector('i')) return;

                const cells = row.querySelectorAll('td, th');
                const cellElements = Array.from(cells).filter(node => node instanceof Element) as Element[];

                // Row with incident details (6 cells, no colspan on first)
                if (cellElements.length === 6 && !cellElements[0]?.hasAttribute('colspan')) {
                    incident.date = processDate(cellElements[0]?.textContent?.trim() ?? '');
                    incident.reference = cellElements[1]?.textContent?.trim() ?? ''; // This becomes part of referenceId later
                    incident.region = cellElements[2]?.textContent?.trim() ?? '';
                    incident.category = cellElements[3]?.textContent?.trim() ?? '';
                    incident.aggressors = cellElements[4]?.textContent?.trim() ?? '';
                    incident.source_reported = cellElements[5]?.textContent?.trim() ?? ''; // Original source field name
                }

                // Row with description (1 cell spanning 6 columns)
                if (cellElements.length === 1 && cellElements[0]?.getAttribute('colspan') === '6') {
                    description = cellElements[0]?.textContent?.trim() ?? '';
                }
            });
        }

        // --- Description and Update Parsing (ported logic) ---
        description = description.replace(/last updated:.*$/i, '').trim(); // Remove "last updated" part

        const updateRegex = /\b(UPDATE\s*\d*:?|Update\s*\d*:?)\s*(.*?)(?=\b(UPDATE\s*\d*:?|Update\s*\d*:?)|$)/gis;
        let match;
        const extractedUpdates: { prefix: string; text: string }[] = [];

        // Reset regex lastIndex before using in loop
        updateRegex.lastIndex = 0;
        while ((match = updateRegex.exec(description)) !== null) {
            const updatePrefix = match[1].trim();
            const updateText = match[2].trim();
            if (updateText) {
                extractedUpdates.push({ prefix: updatePrefix, text: updateText });
            }
            // Prevent infinite loops with zero-width matches
             if (match.index === updateRegex.lastIndex) {
                updateRegex.lastIndex++;
            }
        }

        if (extractedUpdates.length > 0) {
            // Find the index of the first update prefix to split description
            const firstUpdateIndex = description.indexOf(extractedUpdates[0].prefix);
            incident.description = (firstUpdateIndex !== -1 ? description.slice(0, firstUpdateIndex) : description).trim();
            incident.update_text = extractedUpdates // Store combined updates in a specific field
                .map(update => `${update.prefix} ${update.text}`)
                .join('\n\n');
        } else {
            incident.description = description.trim();
            incident.update_text = null; // Consistent null value
        }
        // --- End Description and Update Parsing ---


        // TODO: Implement coordinate extraction if possible and needed.
        // The original parser didn't include this logic.
        // incident.latitude = ...;
        // incident.longitude = ...;

        // Add incident only if essential fields are present (e.g., title, description, reference)
        if (incident.title && incident.description && incident.reference) {
            // Add source field explicitly using the passed argument
            incident.source = sourceName;
            incidents.push(incident);
        } else {
            log.warn(`Skipping parsed ${sourceName} section due to missing title, description, or reference`, { title: incident.title, reference: incident.reference });
        }
    });

  } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Error parsing CWD HTML content', { error: error.message, stack: error.stack });
      // Depending on requirements, might want to return partial results or throw
  }

  log.info(`Parsed ${incidents.length} incidents from CWD HTML`);
  return incidents;
}
