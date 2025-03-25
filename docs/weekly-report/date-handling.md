# Weekly Report Date Handling

This document explains how dates are calculated and managed in the Weekly Report system.

## Reporting Period Standard

The Weekly Report uses a standardized reporting period of **Monday 21:00 UTC to Monday 21:00 UTC** for all reports. This ensures consistency across reports and aligns with maritime industry standards.

## Key Date Functions

The following functions in `src/shared/features/weekly-report/utils/dates.js` handle date calculations:

### getCurrentReportingWeek()

Calculates the current/most recent reporting period:

```javascript
export function getCurrentReportingWeek() {
  const now = new Date();
  
  // Find the most recent Monday at 2100 UTC
  let mondayEnd = new Date(now);
  
  // Adjust to the correct day (Monday)
  const currentDay = mondayEnd.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  let daysToAdjust = 0;
  
  if (currentDay === 1) {
    // Today is Monday - check if it's before or after 2100 UTC
    const currentHour = mondayEnd.getUTCHours();
    if (currentHour < 21) {
      // Before 2100 UTC - use previous Monday
      daysToAdjust = -7;
    }
    // After 2100 UTC - use today (daysToAdjust stays 0)
  } else if (currentDay === 0) {
    // Sunday - find previous Monday
    daysToAdjust = -6;
  } else {
    // Tuesday through Saturday - find previous Monday
    daysToAdjust = -(currentDay - 1);
  }
  
  // Apply the adjustment to get to Monday
  mondayEnd.setUTCDate(mondayEnd.getUTCDate() + daysToAdjust);
  
  // Set to exactly 2100 UTC (9:00 PM)
  mondayEnd.setUTCHours(21, 0, 0, 0);
  
  // Start date is exactly 7 days before end date
  const mondayStart = new Date(mondayEnd);
  mondayStart.setUTCDate(mondayEnd.getUTCDate() - 7);
  
  return { start: mondayStart, end: mondayEnd };
}
```

### getReportingWeek(year, week)

Calculates a specific reporting period based on year and week number:

```javascript
export function getReportingWeek(year, week) {
  // Get the first day of the year
  const firstDay = new Date(Date.UTC(year, 0, 1));
  
  // Find the first Monday of the year
  let firstMonday = new Date(firstDay);
  while (firstMonday.getUTCDay() !== 1) {
    firstMonday.setUTCDate(firstMonday.getUTCDate() + 1);
  }
  
  // Calculate target Monday (end date) by adding weeks
  const end = new Date(firstMonday);
  end.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  
  // Set to exactly 2100 UTC (9:00 PM)
  end.setUTCHours(21, 0, 0, 0);

  // Start date is exactly 7 days before end date
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 7);
  
  return { start, end };
}
```

### getYearWeek(date)

Returns the year and week number for a given date:

```javascript
export function getYearWeek(date) {
  const year = date.getUTCFullYear();
  
  // Use ISO week number calculation, which is standard
  // Get the date for the Thursday in that week
  const target = new Date(date);
  const day = target.getUTCDay();
  const diff = day === 0 ? 3 : 4 - day; // Adjust to get to Thursday (day 4)
  
  target.setUTCDate(target.getUTCDate() + diff);
  
  // Calculate first Thursday of the year
  const firstDayOfYear = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const firstThursday = new Date(firstDayOfYear);
  
  // Find first Thursday
  firstThursday.setUTCDate(
    firstDayOfYear.getUTCDate() + 
    (firstDayOfYear.getUTCDay() <= 4 ? 
      4 - firstDayOfYear.getUTCDay() : 
      11 - firstDayOfYear.getUTCDay())
  );
  
  // Calculate week number
  const weekNum = 1 + Math.floor((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  
  return { year, week: weekNum };
}
```

## URL Format

Weekly Report URLs use the format:

```
/weekly-report/YYYY-WW
```

Where:
- `YYYY` is the four-digit year
- `WW` is the two-digit week number

Example: `/weekly-report/2025-12` (Week 12 of 2025: March 17-24)

## Date Display

Dates are displayed in a human-readable format using the `formatDateRange` function:

```javascript
export function formatDateRange(start, end) {
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return `${start.toLocaleDateString(
    "en-US",
    options
  )} - ${end.toLocaleDateString("en-US", options)}`;
}
```

Example: "Mar 17, 2025 - Mar 24, 2025"

## Timezone Handling

All date calculations use UTC to ensure consistency across different timezones:

- Server-side functions use `getUTCDay()`, `setUTCDate()`, etc.
- The 21:00 UTC time boundary is set using `setUTCHours(21, 0, 0, 0)`
- ISO strings are used for API communication (e.g., `2025-03-17T21:00:00.000Z`)