export function getCurrentReportingWeek() {
  const now = new Date();
  // Find next Monday (or today if it's Monday)
  const end = new Date(now);
  end.setDate(now.getDate() + ((1 + 7 - end.getDay()) % 7));
  // Set to start of day
  end.setHours(0, 0, 0, 0);

  // Start date is 7 days before end
  const start = new Date(end);
  start.setDate(end.getDate() - 7);

  return { start, end };
}

export function getReportingWeek(year, week) {
  // Get the end date (Monday) for the specified week
  const end = new Date(year, 0, 1 + (week - 1) * 7);
  while (end.getDay() !== 1) {
    // Adjust to next Monday
    end.setDate(end.getDate() + 1);
  }
  end.setHours(0, 0, 0, 0);

  // Start date is 7 days before end
  const start = new Date(end);
  start.setDate(end.getDate() - 7);

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
