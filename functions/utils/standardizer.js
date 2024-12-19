export const standardizeIncident = (incident, sourceName, sourceUrl) => ({
  sourceId: `${sourceName}-${incident.reference}`,
  source: sourceName,
  sourceUrl,
  dateOccurred: incident.dateOccurred || incident.date, // Accept either format
  latitude: incident.latitude,
  longitude: incident.longitude,
  region: incident.region,
  type: incident.category || incident.type,
  title: incident.title,
  description: incident.description,
  updates:
    incident.updates || (incident.update ? [{ text: incident.update }] : []),
  aggressors: incident.aggressors,
  originalSource: incident.source,
  raw: incident,
});
