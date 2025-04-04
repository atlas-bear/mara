# Prompts System

The MARA prompts system is a centralized framework for managing interactions with AI models. This system ensures consistency, reusability, and maintainability across all AI-powered features.

## Directory Structure

```
/functions/prompts/
  ├── index.js               # Central registry with getPrompt function
  ├── config.js              # Shared config settings and model versions
  ├── reference-data.js      # Shared options like weapons, items, etc.
  ├── templates/             # Template fragments for reuse
  ├── incident-analysis.js   # Incident analysis prompt
  ├── weekly-report-analysis.js  # Weekly report prompt
  └── description-enhancement.js  # Description enhancement prompt
```

## Available Prompts

| Prompt Type | File | Description | Model |
|-------------|------|-------------|-------|
| `incidentAnalysis` | `incident-analysis.js` | Detailed analysis of maritime incidents | Claude 3.5 Sonnet |
| `weeklyReport` | `weekly-report-analysis.js` | Weekly maritime security report and forecast | Claude 3.5 Sonnet |
| `descriptionEnhancement` | `description-enhancement.js` | Standardizes and enhances incident descriptions | Claude 3.5 Sonnet |

## Key Components

### 1. Prompt Registry (`index.js`)

The central registry that exports all prompts with a unified getter function:

```javascript
export const getPrompt = (promptType) => {
  if (!prompts[promptType]) {
    throw new Error(`Prompt type '${promptType}' not found`);
  }
  return prompts[promptType];
};
```

### 2. Configuration (`config.js`)

Standardized model versions and settings:

```javascript
export const MODELS = {
  SONNET: "claude-3-5-sonnet-20240620",
  HAIKU: "claude-3-haiku-20240307",
  // ...
};

export const CONFIGS = {
  INCIDENT_ANALYSIS: {
    model: MODELS.SONNET,
    max_tokens: 1500,
    temperature: 0.2,
  },
  // ...
};
```

### 3. Reference Data (`reference-data.js`)

Shared option lists used across prompts:

```javascript
export const WEAPONS = [
  "Firearms (unspecified)",
  "Knives",
  // ...
];

export const getReferenceData = (category) => {
  switch (category.toLowerCase()) {
    case 'weapons':
      return WEAPONS;
    // ...
  }
};
```

### 4. Individual Prompt Files

Each prompt file exports:

1. A creation function that generates the prompt string
2. A configuration object for the model settings

Example:

```javascript
export const createIncidentAnalysisPrompt = (incidentData, recordFields) => {
  // Create the prompt string
  return `...`;
};

export const promptConfig = CONFIGS.INCIDENT_ANALYSIS;
```

## Usage

### Basic Usage

```javascript
import { callClaudeWithPrompt } from "./utils/llm-service.js";

// For incident analysis
const result = await callClaudeWithPrompt("incidentAnalysis", {
  incidentData: { /* raw data */ },
  recordFields: { /* processed fields */ }
});
```

### Response Processing

Responses are automatically processed by specialized processors in `llm-processors.js`:

```javascript
// Process the response based on prompt type
switch (promptType) {
  case "incidentAnalysis":
    return processIncidentAnalysisResponse(responseText);
  case "weeklyReport":
    return processWeeklyReportResponse(responseText);
  // ...
}
```

## Adding New Prompts

1. Create a new file for your prompt (e.g., `new-prompt-type.js`)
2. Export `createPrompt` function and `promptConfig` object
3. Add the prompt to the registry in `index.js`
4. Add a processor function to `llm-processors.js`
5. Update the switch statements in `llm-service.js`

## Best Practices

1. **Reuse Reference Data**: Use the centralized reference data for consistent options
2. **Use Standard Models**: Refer to models in `config.js` rather than hardcoding
3. **Structure Responses**: Design prompts to return structured data (typically JSON)
4. **Document Versions**: Include version numbers and update dates in your prompt files
5. **Include Examples**: Provide example outputs in your prompt instructions