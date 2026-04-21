import { supabase } from './supabase.js';

/**
 * Global Authentication Information
 * Replaces mock-data.js currentUser with real Supabase session data
 */

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Extract metadata or fall back to email
  const name = user.user_metadata?.full_name || user.email.split('@')[0];
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  return {
    id: user.id,
    name: name,
    email: user.email,
    initials: initials,
    role: user.user_metadata?.role || 'Guest'
  };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.hash = '/'; // Go to login/landing
}
