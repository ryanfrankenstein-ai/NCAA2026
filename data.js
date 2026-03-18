// 2026 NCAA Men's Tournament Bracket Data
// First Four winners advance to replace their spots

const BRACKET_DATA = {
  firstFour: [
    { id: 'ff1', game: 'UMBC vs Howard', teams: ['UMBC (24-8)', 'Howard (23-10)'], region: 'midwest' },
    { id: 'ff2', game: 'Lehigh vs PVAMU', teams: ['Lehigh (18-16)', 'Prairie View A&M (18-17)'], region: 'south' },
    { id: 'ff3', game: 'NC State vs Texas', teams: ['NC State (20-13)', 'Texas (18-14)'], region: 'west' },
    { id: 'ff4', game: 'SMU vs Miami (OH)', teams: ['SMU (20-13)', 'Miami (Ohio) (31-1)'], region: 'midwest' },
  ],

  regions: {
    east: {
      name: 'EAST',
      location: 'Washington, D.C.',
      matchups: [
        { id: 'e1', r1: { seed: 1, name: 'Duke', record: '32-2' }, r2: { seed: 16, name: 'Siena', record: '23-11' } },
        { id: 'e2', r1: { seed: 8, name: 'Ohio St.', record: '21-12' }, r2: { seed: 9, name: 'TCU', record: '22-11' } },
        { id: 'e3', r1: { seed: 5, name: "St. John's", record: '28-6' }, r2: { seed: 12, name: 'Northern Iowa', record: '23-12' } },
        { id: 'e4', r1: { seed: 4, name: 'Kansas', record: '23-10' }, r2: { seed: 13, name: 'Cal Baptist', record: '25-8' } },
        { id: 'e5', r1: { seed: 6, name: 'Louisville', record: '23-10' }, r2: { seed: 11, name: 'South Florida', record: '25-8' } },
        { id: 'e6', r1: { seed: 3, name: 'Michigan St.', record: '25-7' }, r2: { seed: 14, name: 'North Dakota St.', record: '27-7' } },
        { id: 'e7', r1: { seed: 7, name: 'UCLA', record: '23-11' }, r2: { seed: 10, name: 'UCF', record: '21-11' } },
        { id: 'e8', r1: { seed: 2, name: 'UConn', record: '29-5' }, r2: { seed: 15, name: 'Furman', record: '22-12' } },
      ]
    },
    west: {
      name: 'WEST',
      location: 'San Jose, CA',
      matchups: [
        { id: 'w1', r1: { seed: 1, name: 'Arizona', record: '32-2' }, r2: { seed: 16, name: 'Long Island', record: '24-10' } },
        { id: 'w2', r1: { seed: 8, name: 'Villanova', record: '24-8' }, r2: { seed: 9, name: 'Utah St.', record: '28-6' } },
        { id: 'w3', r1: { seed: 5, name: 'Wisconsin', record: '24-10' }, r2: { seed: 12, name: 'High Point', record: '30-4' } },
        { id: 'w4', r1: { seed: 4, name: 'Arkansas', record: '26-8' }, r2: { seed: 13, name: 'Hawaii', record: '24-8' } },
        { id: 'w5', r1: { seed: 6, name: 'BYU', record: '23-11' }, r2: { seed: 11, name: 'NC St/Texas', record: 'TBD', firstFour: 'ff3' } },
        { id: 'w6', r1: { seed: 3, name: 'Gonzaga', record: '30-3' }, r2: { seed: 14, name: 'Kennesaw St.', record: '21-13' } },
        { id: 'w7', r1: { seed: 7, name: 'Miami (FL)', record: '25-8' }, r2: { seed: 10, name: 'Missouri', record: '20-12' } },
        { id: 'w8', r1: { seed: 2, name: 'Purdue', record: '27-8' }, r2: { seed: 15, name: 'Queens (N.C.)', record: '21-13' } },
      ]
    },
    south: {
      name: 'SOUTH',
      location: 'Houston, TX',
      matchups: [
        { id: 's1', r1: { seed: 1, name: 'Florida', record: '26-7' }, r2: { seed: 16, name: 'Lehigh/PVAMU', record: 'TBD', firstFour: 'ff2' } },
        { id: 's2', r1: { seed: 8, name: 'Clemson', record: '24-10' }, r2: { seed: 9, name: 'Iowa', record: '21-12' } },
        { id: 's3', r1: { seed: 5, name: 'Vanderbilt', record: '26-8' }, r2: { seed: 12, name: 'McNeese', record: '28-5' } },
        { id: 's4', r1: { seed: 4, name: 'Nebraska', record: '26-6' }, r2: { seed: 13, name: 'Troy', record: '22-11' } },
        { id: 's5', r1: { seed: 6, name: 'North Carolina', record: '24-8' }, r2: { seed: 11, name: 'VCU', record: '27-7' } },
        { id: 's6', r1: { seed: 3, name: 'Illinois', record: '24-8' }, r2: { seed: 14, name: 'Penn', record: '18-11' } },
        { id: 's7', r1: { seed: 7, name: "Saint Mary's", record: '27-5' }, r2: { seed: 10, name: 'Texas A&M', record: '21-11' } },
        { id: 's8', r1: { seed: 2, name: 'Houston', record: '28-6' }, r2: { seed: 15, name: 'Idaho', record: '21-14' } },
      ]
    },
    midwest: {
      name: 'MIDWEST',
      location: 'Chicago, IL',
      matchups: [
        { id: 'm1', r1: { seed: 1, name: 'Michigan', record: '31-3' }, r2: { seed: 16, name: 'HOW/UMBC', record: 'TBD', firstFour: 'ff1' } },
        { id: 'm2', r1: { seed: 8, name: 'Georgia', record: '22-10' }, r2: { seed: 9, name: 'Saint Louis', record: '28-5' } },
        { id: 'm3', r1: { seed: 5, name: 'Texas Tech', record: '22-10' }, r2: { seed: 12, name: 'Akron', record: '29-5' } },
        { id: 'm4', r1: { seed: 4, name: 'Alabama', record: '23-9' }, r2: { seed: 13, name: 'Hofstra', record: '24-10' } },
        { id: 'm5', r1: { seed: 6, name: 'Tennessee', record: '22-11' }, r2: { seed: 11, name: 'SMU/MIA OH', record: 'TBD', firstFour: 'ff4' } },
        { id: 'm6', r1: { seed: 3, name: 'Virginia', record: '29-5' }, r2: { seed: 14, name: 'Wright St.', record: '23-11' } },
        { id: 'm7', r1: { seed: 7, name: 'Kentucky', record: '21-13' }, r2: { seed: 10, name: 'Santa Clara', record: '26-8' } },
        { id: 'm8', r1: { seed: 2, name: 'Iowa St.', record: '27-7' }, r2: { seed: 15, name: 'Tennessee St.', record: '23-9' } },
      ]
    }
  }
};

// ESPN API uses these group IDs
const ESPN_GROUP_ID = 'mens-college-basketball';
const ESPN_TOURNAMENT_SLUG = 'mncaa';

// ============================================================
// GROUP MEMBERS & BRACKET PICKS
// picks: { r64, r32, s16, e8, ff, champion }
// Each array = teams picked to WIN that round (advance past it)
// ============================================================
const GROUP_PICKS = [
  {
    name: 'Ryan',
    bracketName: 'Better Laettner Than Never',
    picks: {
      // Round of 64 winners (picked to advance to R32)
      r64: [
        'Duke','TCU','St. John\'s','Kansas','Louisville','Michigan St.','UCLA','Connecticut', // East
        'Florida','Iowa','Vanderbilt','Nebraska','VCU','Illinois','Texas A&M','Houston',       // South
        'Arizona','Utah St.','Wisconsin','Arkansas','BYU','Gonzaga','Missouri','Purdue',       // West
        'Michigan','Saint Louis','Texas Tech','Alabama','MOH/SMU','Virginia','Santa Clara','Iowa St.' // Midwest
      ],
      // Round of 32 winners (picked to advance to S16)
      r32: [
        'Duke','St. John\'s','Louisville','UCLA',        // East
        'Florida','Vanderbilt','Illinois','Texas A&M',   // South (note: Texas A&M over Houston)
        'Arizona','Wisconsin','BYU','Missouri',           // West (note: Missouri over Purdue)
        'Michigan','Texas Tech','Virginia','Iowa St.'    // Midwest (note: Virginia over MOH/SMU)
      ],
      // Sweet 16 winners (picked to advance to E8)
      s16: [
        'Duke','Michigan St.',   // East (Michigan St. = Connecticut bracket side win)
        'Florida','Illinois',    // South
        'Arizona','BYU',         // West
        'Michigan','Iowa St.'    // Midwest
      ],
      // Elite 8 winners (picked to advance to FF)
      e8: [
        'Duke',     // East champion
        'Illinois', // South champion (upset pick: Illinois over Florida)
        'Arizona',  // West champion
        'Iowa St.'  // Midwest champion (upset pick: Iowa St. over Michigan)
      ],
      // Final Four winners (picked to advance to championship)
      ff: [
        'Illinois', // beats Duke
        'Arizona',  // beats Iowa St.
      ],
      champion: 'Arizona'
    }
  }
  // More members will be added here as brackets are submitted
];
