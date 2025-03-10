export const mockHistoricalTrends = {
  "West Africa": [
    { month: "May", value: 8 },
    { month: "Jun", value: 6 },
    { month: "Jul", value: 9 },
    { month: "Aug", value: 5 },
    { month: "Sep", value: 7 },
    { month: "Oct", value: 10 },
  ],
  "Southeast Asia": [
    { month: "May", value: 12 },
    { month: "Jun", value: 15 },
    { month: "Jul", value: 10 },
    { month: "Aug", value: 14 },
    { month: "Sep", value: 16 },
    { month: "Oct", value: 13 },
  ],
  "Indian Ocean": [
    { month: "May", value: 6 },
    { month: "Jun", value: 4 },
    { month: "Jul", value: 3 },
    { month: "Aug", value: 5 },
    { month: "Sep", value: 2 },
    { month: "Oct", value: 4 },
  ],
  Americas: [
    { month: "May", value: 4 },
    { month: "Jun", value: 3 },
    { month: "Jul", value: 5 },
    { month: "Aug", value: 3 },
    { month: "Sep", value: 2 },
    { month: "Oct", value: 3 },
  ],
  Europe: [
    { month: "May", value: 5 },
    { month: "Jun", value: 3 },
    { month: "Jul", value: 6 },
    { month: "Aug", value: 8 },
    { month: "Sep", value: 7 },
    { month: "Oct", value: 4 },
  ],
};

// Detailed monthly data for each region
export const regionalMonthlyData = {
  "Southeast Asia": [
    { month: "Oct", incidents: 7, robberies: 7 },
    { month: "Nov", incidents: 6, robberies: 5, boardings: 1 },
    { month: "Dec", incidents: 8, robberies: 8 },
    { month: "Jan", incidents: 6, robberies: 6 },
    { month: "Feb", incidents: 4, robberies: 4 },
    { month: "Mar", incidents: 0 },
  ],

  "Indian Ocean": [
    { month: "Oct", incidents: 8, attacks: 5, other: 3 },
    { month: "Nov", incidents: 9, attacks: 3, other: 6 },
    { month: "Dec", incidents: 3, attacks: 2, other: 1 },
    { month: "Jan", incidents: 0 },
    { month: "Feb", incidents: 2, other: 2 },
    { month: "Mar", incidents: 0 },
  ],

  Americas: [
    { month: "Oct", incidents: 3, robberies: 3 },
    { month: "Nov", incidents: 0 },
    { month: "Dec", incidents: 0 },
    { month: "Jan", incidents: 0 },
    { month: "Feb", incidents: 0 },
    { month: "Mar", incidents: 0 },
  ],

  Europe: [
    { month: "Oct", incidents: 4, attacks: 4 },
    { month: "Nov", incidents: 1, attacks: 1 },
    { month: "Dec", incidents: 0 },
    { month: "Jan", incidents: 0 },
    { month: "Feb", incidents: 0 },
    { month: "Mar", incidents: 0 },
  ],

  "West Africa": [
    { month: "Oct", incidents: 1, robberies: 1 },
    { month: "Nov", incidents: 1, other: 1 },
    { month: "Dec", incidents: 3, attacks: 1, boardings: 2 },
    { month: "Jan", incidents: 2, robberies: 1, boardings: 1 },
    { month: "Feb", incidents: 2, robberies: 1, boardings: 1 },
    { month: "Mar", incidents: 0 },
  ],
};

// Regional statistics for Quick Stats section
export const regionalStats = {
  "Southeast Asia": {
    ytdIncidents: 10,
    changeFromLastYear: 42.86, // positive percentage
    lastYearIncidents: 7,
    changeDirection: "up", // up, down, or none
    lastWeekIncidents: 1,  // incidents from last week
    weeklyChangeDirection: "up" // compared to current week
  },
  
  "Indian Ocean": {
    ytdIncidents: 2,
    changeFromLastYear: 97.10, // positive percentage 
    lastYearIncidents: 69,
    changeDirection: "down",
    lastWeekIncidents: 0,
    weeklyChangeDirection: "none"
  },
  
  "West Africa": {
    ytdIncidents: 4,
    changeFromLastYear: 63.64, // positive percentage
    lastYearIncidents: 11,
    changeDirection: "down",
    lastWeekIncidents: 1,
    weeklyChangeDirection: "up"
  },
  
  "Europe": {
    ytdIncidents: 0,
    changeFromLastYear: 100, // positive percentage
    lastYearIncidents: 1,
    changeDirection: "down",
    lastWeekIncidents: 0,
    weeklyChangeDirection: "none"
  },
  
  "Americas": {
    ytdIncidents: 0,
    changeFromLastYear: 0, // percentage
    lastYearIncidents: 0,
    changeDirection: "none",
    lastWeekIncidents: 0,
    weeklyChangeDirection: "none"
  }
};
