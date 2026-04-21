import { supabase } from '../js/lib/supabase.js';

async function checkTables() {
    // This is a hacky way to guess table names or check schema if allowed
    const { data: teams } = await supabase.from('teams').select('count', { count: 'exact', head: true });
    const { data: adj } = await supabase.from('adjudicators').select('count', { count: 'exact', head: true });
    console.log('Teams:', teams);
    console.log('Adjudicators:', adj);
}

checkTables();
