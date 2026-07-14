import { supabase } from './supabase.js';

/**
 * BP Pairing Engine
 * Implements 5-step pairing for British Parliamentary debate.
 */
export const BPEngine = {
  shuffle: (items) => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },
  
  /**
   * Main entry point to generate a draw for a round.
   */
  generateDraw: async (roundId, tournamentId, roundNum, targetPanelSize = 1, roomNames = []) => {
    // 1. Fetch Data
    const { data: allTeams, error: teamError } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId);
    const { data: judges, error: judgeError } = await supabase.from('adjudicators').select('*').eq('tournament_id', tournamentId).eq('status', 'Active');
    const { data: prevPairings, error: pairingError } = await supabase.from('draw_pairings').select('*').eq('tournament_id', tournamentId);
    if (teamError) throw teamError;
    if (judgeError) throw judgeError;
    if (pairingError) throw pairingError;

    // Only active teams enter the draw. Teams created via registration/CSV/manual entry
    // may have a null status, so exclude only those explicitly marked Inactive.
    const teams = (allTeams || []).filter(team => (team.status || 'Active') !== 'Inactive');

    if (teams.length < 4) throw new Error('Need at least 4 active teams to generate a BP draw.');
    if (teams.length % 4 !== 0) throw new Error('BP draws need an active team count divisible by 4. Add swing teams or deactivate extras before generating pairings.');

    // 2. Step 1: Sorting Teams (The Ladder)
    let sortedTeams = [];
    if (roundNum === 1) {
      sortedTeams = BPEngine.shuffle(teams);
    } else {
      const standings = await BPEngine.calculateStandings(tournamentId, teams);
      sortedTeams = standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.speaks !== a.speaks) return b.speaks - a.speaks;
        return a.name.localeCompare(b.name);
      });
    }

    // 3. Step 2: Bracketing
    const rooms = [];
    const teamPool = [...sortedTeams];
    let roomCounter = 1;
    const configuredRooms = (roomNames || []).map(name => String(name || '').trim()).filter(Boolean);
    while (teamPool.length >= 4) {
      const roomIndex = roomCounter - 1;
      rooms.push({ label: configuredRooms[roomIndex] || `Room ${roomCounter}`, teams: teamPool.splice(0, 4) });
      roomCounter += 1;
    }

    // 4. Step 3: Positions
    const pairings = rooms.map(room => {
      const allocated = BPEngine.allocatePositions(room.teams, prevPairings);
      return {
        round_id: roundId,
        tournament_id: tournamentId,
        room_label: room.label,
        og_team_id: allocated.OG.id,
        oo_team_id: allocated.OO.id,
        cg_team_id: allocated.CG.id,
        co_team_id: allocated.CO.id,
        jitsi_link: `https://meet.jit.si/Tabra_${tournamentId.substring(0,8)}_${room.label.replace(/[^a-zA-Z0-9]/g, '')}`
      };
    });

    // 5. Step 4: Top-down allocation using the administrator's exact panel size.
    const allocations = [];
    const availableJudges = [...judges].sort((a, b) => (b.score || 0) - (a.score || 0));
    const panelSize = Math.max(1, Math.floor(Number(targetPanelSize) || 1));
    const votingJudges = availableJudges.filter(j => !j.is_trainee);
    const trainees = availableJudges.filter(j => j.is_trainee);

    if (votingJudges.length < pairings.length) {
      throw new Error(`Need at least ${pairings.length} active voting adjudicators to chair this draw.`);
    }
    const requiredAdjudicators = pairings.length * panelSize;
    if (availableJudges.length < requiredAdjudicators) {
      throw new Error(`Panel size ${panelSize} requires ${requiredAdjudicators} active adjudicators, but only ${availableJudges.length} are available.`);
    }

    // Assign one voting chair to every debate.
    pairings.forEach((p, idx) => {
      const judge = votingJudges.shift();
      p.chair_id = judge.id;
    });

    // Fill every remaining slot. Voting adjudicators are preferred, then trainees.
    const remainingJudges = [...votingJudges, ...trainees];
    for (let slot = 1; slot < panelSize; slot += 1) {
      pairings.forEach((pairing, pairingIdx) => {
        const judge = remainingJudges.shift();
        allocations.push({
          pairing_idx: pairingIdx,
          adjudicator_id: judge.id,
          role: judge.is_trainee ? 'TRAINEE' : 'WING'
        });
      });
    }

    return { pairings, allocations };
  },

  /**
   * Calculates points and speaks for all teams based on past ballots.
   */
  calculateStandings: async (tournamentId, teams) => {
    const { data: ballots } = await supabase.from('ballots').select('*').eq('tournament_id', tournamentId);
    
    return teams.map(team => {
      const teamBallots = ballots?.filter(b => b.team_id === team.id) || [];
      const points = teamBallots.reduce((acc, b) => acc + (b.points || 0), 0);
      const speaks = teamBallots.reduce((acc, b) => acc + (b.speaker_points || 0), 0);
      return { ...team, points, speaks };
    });
  },

  /**
   * Rough position balancing logic.
   */
  allocatePositions: (teams, history = []) => {
    const roles = ['OG', 'OO', 'CG', 'CO'];
    const result = {};

    const roleColumns = {
      OG: 'og_team_id',
      OO: 'oo_team_id',
      CG: 'cg_team_id',
      CO: 'co_team_id'
    };

    const countsByTeam = new Map();
    teams.forEach((team) => {
      const counts = { OG: 0, OO: 0, CG: 0, CO: 0 };
      history.forEach((pairing) => {
        roles.forEach((role) => {
          if (pairing[roleColumns[role]] === team.id) counts[role] += 1;
        });
      });
      countsByTeam.set(team.id, counts);
    });

    BPEngine.shuffle(teams).forEach((team) => {
      const availableRoles = roles.filter(role => !result[role]);
      const counts = countsByTeam.get(team.id);
      const bestRole = availableRoles.sort((a, b) => {
        if (counts[a] !== counts[b]) return counts[a] - counts[b];
        return roles.indexOf(a) - roles.indexOf(b);
      })[0];

      result[bestRole] = team;
    });

    return result;
  },

  hasClash: (teams) => {
    const insts = teams.map(t => t.institution).filter(Boolean);
    return new Set(insts).size !== insts.length;
  },

  wouldClash: (existing, candidate) => {
    return existing.some(t => t.institution === candidate.institution);
  }
};
