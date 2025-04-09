export function getCurrentReportingWeek() {
  // Get current date/time in UTC
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
  
  // Verify these are both Mondays
  const startDay = mondayStart.getUTCDay();
  const endDay = mondayEnd.getUTCDay();
  
  if (startDay !== 1 || endDay !== 1) {
    console.error(`Dynamic reporting period error: start day = ${startDay}, end day = ${endDay}`);
  }
  
  // For debugging
  console.log(`Current reporting period: ${mondayStart.toISOString()} to ${mondayEnd.toISOString()}`);
  console.log(`Days: Start = ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDay]}, End = ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][endDay]}`);

  return { start: mondayStart, end: mondayEnd };
}

export function getReportingWeek(year, week) {
  // Calculate dates dynamically for all weeks
  
  // Get the first day of the year
  const firstDay = new Date(Date.UTC(year, 0, 1));
  
  // Find the first Monday of the year
  let firstMonday = new Date(firstDay);
  while (firstMonday.getUTCDay() !== 1) {
    firstMonday.setUTCDate(firstMonday.getUTCDate() + 1);
  }
  
  // Calculate the target Monday for the specified week
  // Week 1 is the week containing the first Monday of the year
  // So add (week-1)*7 days to the first Monday
  const end = new Date(firstMonday);
  end.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  
  // Set to exactly 2100 UTC (9:00 PM)
  end.setUTCHours(21, 0, 0, 0);
  
  // Start date is exactly 7 days before end date
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 7);
  
  // Verify these are both Mondays (debugging)
  const startDay = start.getUTCDay();
  const endDay = end.getUTCDay();
  
  if (startDay !== 1 || endDay !== 1) {
    console.error(`Week ${week} of ${year} calculation error: start day = ${startDay}, end day = ${endDay}`);
    console.error(`Start: ${start.toISOString()}, End: ${end.toISOString()}`);
  } else {
    console.log(`Week ${week} of ${year}: ${start.toISOString()} to ${end.toISOString()}`);
    console.log(`Verified Monday to Monday: start day = ${startDay}, end day = ${endDay}`);
  }

  return { start, end };
}

export function formatDateRange(start, end) {
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return `${start.toLocaleDateString(
    "en-GB",
    options
  )} - ${end.toLocaleDateString("en-GB", options)}`;
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

/**
 * Returns the year-week code from a date that matches URL format
 * This function reverses getReportingWeek() to find the original week number
 * @param {Date} date - The date to get year-week for
 * @returns {Object} Object with year and week properties
 */
export function getYearWeek(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  // Get the first day of the year
  const firstDay = new Date(Date.UTC(year, 0, 1));
  
  // Find the first Monday of the year
  let firstMonday = new Date(firstDay);
  while (firstMonday.getUTCDay() !== 1) {
    firstMonday.setUTCDate(firstMonday.getUTCDate() + 1);
  }
  
  // Calculate days between the first Monday and our date
  const dateObj = new Date(Date.UTC(year, month, day));
  dateObj.setUTCHours(21, 0, 0, 0); // Match 2100 UTC for accuracy
  
  // Calculate milliseconds between dates
  const millisecDiff = dateObj.getTime() - firstMonday.getTime();
  
  // Convert to days and add 7 to account for the week before the first Monday
  const daysDiff = Math.floor(millisecDiff / (24 * 60 * 60 * 1000));
  
  // Calculate week number (1-indexed)
  const weekNum = Math.floor(daysDiff / 7) + 1;
  
  return { year, week: weekNum };
}
