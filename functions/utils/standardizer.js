export const standardizeIncident = (incident, sourceName, sourceUrl) => ({
  sourceId: `${sourceName}-${incident.reference}`,
  source: sourceName,
  sourceUrl,
  dateOccurred: incident.date,
  latitude: incident.latitude,
  longitude: incident.longitude,
  region: incident.region,
  type: incident.category,
  title: incident.title,
  description: incident.description,
  updates: incident.update ? [{ text: incident.update }] : [],
  aggressors: incident.aggressors,
  originalSource: incident.source,
  raw: incident,
});
