# MARA Prompts System

This directory contains all the prompt templates used for interaction with Claude AI models throughout the MARA system.

## Structure

- `index.js` - Central registry that exports all prompts with a unified getter function
- `config.js` - Shared configuration including model versions and parameters
- `reference-data.js` - Standard option lists used across prompts
- Individual prompt files (e.g., `incident-analysis.js`, `weekly-report-analysis.js`)

## Available Prompts

| Prompt Type | File | Description | Model |
|-------------|------|-------------|-------|
| `incidentAnalysis` | `incident-analysis.js` | Detailed analysis of maritime incidents | Claude 3.5 Sonnet |
| `weeklyReport` | `weekly-report-analysis.js` | Weekly maritime security report and forecast | Claude 3.5 Sonnet |
| `descriptionEnhancement` | `description-enhancement.js` | Standardizes and enhances incident descriptions | Claude 3.5 Sonnet |

## Usage

```javascript
import { callClaudeWithPrompt } from "./utils/llm-service.js";

// For incident analysis:
const result = await callClaudeWithPrompt("incidentAnalysis", {
  incidentData: { /* raw data */ },
  recordFields: { /* processed fields */ }
});

// For weekly report:
const reportData = await callClaudeWithPrompt("weeklyReport", {
  incidents: weeklyIncidents,
  regionalData: stats,
  startDate: periodStart,
  endDate: periodEnd
});

// For description enhancement:
const enhanced = await callClaudeWithPrompt("descriptionEnhancement", {
  recordFields: rawDataRecord.fields
});
```

## Adding New Prompts

1. Create a new file for your prompt (e.g., `new-prompt-type.js`)
2. Export `createPrompt` function and `promptConfig` object
3. Add the prompt to `index.js`
4. Add a processor function to `llm-processors.js`
5. Update the switch statements in `llm-service.js`

## Templates

Common sections and formatting patterns can be found in the `templates/` directory.