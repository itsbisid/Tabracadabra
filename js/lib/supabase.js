import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ylaqzkzudzpqjpffjiag.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_us8J7w-Wci6S7AWGQXEx8w_d7FKcVao'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
