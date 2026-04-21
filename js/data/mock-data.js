// Mock data for TabraCadabra
export const currentUser = {
  id: 'u1',
  name: 'Awinbisid Desmond-Bugbilla',
  email: 'awinbisid951@gmail.com',
  initials: 'A',
  role: 'Tab Director',
};

export const tournaments = [
  {
    id: 't1',
    name: 'SDEG',
    shortName: 'SDEG',
    description: 'A draft tournament for TabraCadabra platform.',
    status: 'draft',
    date: 'Apr 24, 2026',
    endDate: 'Apr 26, 2026',
    location: 'Online',
    teams: 0,
    judges: 0,
    rounds: 0,
    venues: 0,
    format: 'British Parliamentary',
    userRole: 'Tab Director',
  }
];

export const myTournaments = tournaments.filter(t => t.userRole);

export const tournamentDetail = {
  ...tournaments[0],
  progress: 'setup',
  registrationTotal: 48,
  registrationAccepted: 32,
  registrationPending: 16,
  breakCategories: ['Open', 'Novice'],
  scoring: { min: 60, max: 80, reply: true },
  rounds: [
    {
      id: 'r1',
      name: 'Round 1',
      status: 'draft',
      type: 'RANDOM',
      teamsCheckedIn: 0,
      totalTeams: 146,
      ballotsConfirmed: 0,
      totalBallots: 0,
      drawGenerated: false,
      drawReleased: false,
      adjAllocated: false,
      motionReleased: false,
    },
  ],
  motions: [],
  announcements: [],
  chatMessages: [
    { id: 'm1', user: 'Awinbisid', initials: 'A', text: 'Welcome to the tournament chat!', time: '10:00 AM' },
    { id: 'm2', user: 'Kwame Asante', initials: 'K', text: 'Thanks! Excited to be here. When do draws come out?', time: '10:02 AM' },
    { id: 'm3', user: 'Awinbisid', initials: 'A', text: 'Draws will be released 30 minutes before each round. Stay tuned!', time: '10:05 AM' },
  ],
  voiceRooms: [
    { id: 'vr1', name: 'LOC War Room', desc: 'Private room for organizing committee', icon: 'shield' },
    { id: 'vr2', name: 'General Hangout', desc: 'Open room for socializing between rounds', icon: 'users' },
    { id: 'vr3', name: 'CA Deliberation', desc: 'Private room for chief adjudicators', icon: 'tag' },
  ],
  teamLOC: [
    { role: 'Tab Director', desc: 'Oversees tabulation, draw generation, and results integrity', count: 1, icon: '👑', color: '#EF4444' },
    { role: 'Tab Staff', desc: 'Assists with ballot entry, data verification, and tab operations', count: 0, icon: '📊', color: '#3B82F6' },
    { role: 'Public Speaking Director', desc: 'Runs public speaking rounds and PS participants', count: 0, icon: '🎙️', color: '#8B5CF6' },
    { role: 'Convenor', desc: 'Lead tournament organizer responsible for overall coordination', count: 0, icon: '⭐', color: '#F59E0B' },
    { role: 'Deputy Convenor', desc: 'Supports the convenor with tournament logistics and decisions', count: 0, icon: '🤝', color: '#10B981' },
    { role: 'Chief Adjudicator', desc: 'Sets motions, manages adjudicator allocation and feedback', count: 0, icon: '⚖️', color: '#EC4899' },
    { role: 'DCA', desc: 'Deputy Chief Adjudicator — supports the CA in all adjudication matters', count: 0, icon: '📋', color: '#6366F1' },
    { role: 'Equity Officer', desc: 'Ensures fair treatment and manages equity concerns during the tournament', count: 0, icon: '🛡️', color: '#14B8A6' },
  ],
  teams: [
    { id: 'team1', name: 'Ashesi Titans', institution: 'Ashesi University', speaker1: 'Kwame Asante', speaker2: 'Ama Mensah' },
    { id: 'team2', name: 'KNUST Eagles', institution: 'KNUST', speaker1: 'Yaw Boateng', speaker2: 'Efua Owusu' },
    { id: 'team3', name: 'UG Debaters', institution: 'University of Ghana', speaker1: 'Kofi Agyemang', speaker2: 'Adwoa Sarpong' },
    { id: 'team4', name: 'Cape Coast Lions', institution: 'UCC', speaker1: 'Nana Adjei', speaker2: 'Akua Darko' },
  ],
  adjudicators: [
    { id: 'adj1', name: 'Dr. Kwadwo Amoah', institution: 'Ashesi University', experience: 'Expert' },
    { id: 'adj2', name: 'Michael Tetteh', institution: 'KNUST', experience: 'Intermediate' },
    { id: 'adj3', name: 'Abena Frimpong', institution: 'UG', experience: 'Novice' },
  ],
  venues: [
    { id: 'v1', name: 'Main Auditorium', capacity: 200 },
    { id: 'v2', name: 'Seminar Room A', capacity: 40 },
    { id: 'v3', name: 'Seminar Room B', capacity: 40 },
  ],
  publishSections: {
    liveDraw: true,
    teamStandings: true,
    breakResults: false,
    motions: false,
    checkIn: false,
    feedback: false,
    results: false,
  },
};

export const debateFormats = [
  { id: 'bp', name: 'British Parliamentary', emoji: '🇬🇧', desc: '4 teams, 2 per side, most common worldwide', teamsPerDebate: 4, popular: true },
  { id: 'ws', name: 'World Schools', emoji: '🌍', desc: '2 teams of 3-5 speakers, reply speeches', teamsPerDebate: 2, popular: false },
  { id: 'ap', name: 'Asian Parliamentary', emoji: '🏛️', desc: '2 teams of 3 speakers, POI-based', teamsPerDebate: 2, popular: false },
  { id: 'amer', name: 'American Parliamentary', emoji: '🇺🇸', desc: '2 teams of 2 speakers, cross-examination', teamsPerDebate: 2, popular: false },
  { id: 'custom', name: 'Custom', emoji: '⚡', desc: 'Define your own format rules', teamsPerDebate: null, popular: false },
];

export const breakCategories = [
  { id: 'open', name: 'Open', emoji: '🥇', color: '#F5A623', default: true },
  { id: 'novice', name: 'Novice', emoji: '🌱', color: '#10B981', default: false },
  { id: 'esl', name: 'ESL', emoji: '🌐', color: '#3B82F6', default: false },
  { id: 'proam', name: 'Pro-Am', emoji: '🎓', color: '#8B5CF6', default: false },
];
