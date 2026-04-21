import { createClient } from '@supabase/supabase-js';

// Self-contained client for Node.js execution
const supabaseUrl = 'https://ylaqzkzudzpqjpffjiag.supabase.co';
const supabaseAnonKey = 'sb_publishable_us8J7w-Wci6S7AWGQXEx8w_d7FKcVao';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * THE GREAT WIPE
 * This script purges all tournament-related data from the database.
 */
async function wipeAllData() {
  console.log('--- INITIATING THE GREAT WIPE ---');

  const tables = [
    'judge_feedback',
    'adjudicator_allocations',
    'ballots',
    'draw_pairings',
    'rounds',
    'adjudicators',
    'teams',
    'venues',
    'registration_links',
    'tournament_memberships',
    'tournaments'
  ];

  for (const table of tables) {
    console.log(`Clearing table: ${table}...`);
    // Note: This relies on RLS being disabled or the Anon key having delete permissions
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      if (error.code === '42P01') {
        console.log(`Skipping ${table}: Table does not exist.`);
      } else {
        console.warn(`Could not clear ${table}: ${error.message} (Code: ${error.code})`);
      }
    } else {
      console.log(`Successfully cleared ${table}.`);
    }
  }

  console.log('---------------------------------');
  console.log('The Great Wipe is complete.');
  console.log('Your database is now prepared for Day 1 Production.');
}

wipeAllData();
