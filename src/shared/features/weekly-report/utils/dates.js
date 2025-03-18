export function getCurrentReportingWeek() {
  const now = new Date();
  // Find next Monday (or today if it's Monday)
  const end = new Date(now);
  end.setDate(now.getDate() + ((1 + 7 - end.getDay()) % 7));
  // Set to end of day (23:59:59.999) to include all incidents on the last day
  end.setHours(23, 59, 59, 999);

  // Start date is 7 days before end, at the beginning of day
  const start = new Date(end);
  start.setDate(end.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

export function getReportingWeek(year, week) {
  // Get the end date (Monday) for the specified week
  const end = new Date(year, 0, 1 + (week - 1) * 7);
  while (end.getDay() !== 1) {
    // Adjust to next Monday
    end.setDate(end.getDate() + 1);
  }
  // Set to end of day (23:59:59.999) to include all incidents on the last day
  end.setHours(23, 59, 59, 999);

  // Start date is 7 days before end, at the beginning of day
  const start = new Date(end);
  start.setDate(end.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

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

export function getWeekNumber(date) {
  // Create a copy of the date to avoid modifying the input
  const target = new Date(date.valueOf());

  // Find Thursday of the current week
  const dayNum = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);

  // Get first Thursday of the year
  const firstThursday = new Date(target.getFullYear(), 0, 1);
  if (firstThursday.getDay() !== 4) {
    firstThursday.setMonth(0, 1 + ((4 - firstThursday.getDay() + 7) % 7));
  }

  // Calculate week number
  const weekNum =
    1 + Math.ceil((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));

  return weekNum;
}
