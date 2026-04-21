import { supabase } from './supabase.js';

/**
 * BP Pairing Engine
 * Implements 5-step pairing for British Parliamentary debate.
 */
export const BPEngine = {
  
  /**
   * Main entry point to generate a draw for a round.
   */
  generateDraw: async (roundId, tournamentId, roundNum, targetPanelSize = 3) => {
    // 1. Fetch Data
    const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId);
    const { data: judges } = await supabase.from('adjudicators').select('*').eq('tournament_id', tournamentId).eq('status', 'Active');
    const { data: prevPairings } = await supabase.from('draw_pairings').select('*').eq('tournament_id', tournamentId);
    
    if (!teams || teams.length < 4) throw new Error('Need at least 4 teams to generate a BP draw.');

    // 2. Step 1: Sorting Teams (The Ladder)
    let sortedTeams = [];
    if (roundNum === 1) {
      sortedTeams = [...teams].sort(() => Math.random() - 0.5);
    } else {
      const standings = await BPEngine.calculateStandings(tournamentId, teams);
      sortedTeams = standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.speaks !== a.speaks) return b.speaks - a.speaks;
        return Math.random() - 0.5;
      });
    }

    // 3. Step 2: Bracketing
    const rooms = [];
    const teamPool = [...sortedTeams];
    let roomCounter = 1;
    while (teamPool.length >= 4) {
      rooms.push({ label: `Room ${roomCounter++}`, teams: teamPool.splice(0, 4) });
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
        jitsi_link: `https://meet.jit.si/Tabra_${tournamentId.substring(0,8)}_${room.label.replace(' ', '')}`
      };
    });

    // 5. Step 4: Top-Down Odd-Panel Allocation
    const allocations = [];
    const availableJudges = [...judges].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Separate Trainees
    const votingJudges = availableJudges.filter(j => !j.is_trainee);
    const trainees = availableJudges.filter(j => j.is_trainee);

    // Pass 1: Assign Chairs (Top-Down)
    pairings.forEach((p, idx) => {
      if (votingJudges.length > 0) {
        const judge = votingJudges.shift();
        p.chair_id = judge.id;
        allocations.push({ adjudicator_id: judge.id, role: 'CHAIR' });
      }
    });

    // Pass 2: Assign Wings in Pairs (Maintaining Odd Count: 1-Chair + 2-Wings = 3)
    // We only add wings if targetPanelSize > 1
    if (targetPanelSize >= 3) {
      pairings.forEach((p, idx) => {
        // Assign 2 Wings at a time to keep it odd (3)
        if (votingJudges.length >= 2) {
          const w1 = votingJudges.shift();
          const w2 = votingJudges.shift();
          allocations.push({ pairing_idx: idx, adjudicator_id: w1.id, role: 'WING' });
          allocations.push({ pairing_idx: idx, adjudicator_id: w2.id, role: 'WING' });
        }
      });
    }

    // Pass 3: Distribute Trainees (Supernumerary)
    trainees.forEach((t, idx) => {
      const roomIdx = idx % pairings.length;
      allocations.push({ pairing_idx: roomIdx, adjudicator_id: t.id, role: 'TRAINEE' });
    });

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
  allocatePositions: (teams, history) => {
    const roles = ['OG', 'OO', 'CG', 'CO'];
    const result = {};
    
    // For now, simplify: assign randomly but we could scan history for better balance
    const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);
    teams.forEach((team, idx) => {
      result[shuffledRoles[idx]] = team;
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
