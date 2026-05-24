import { supabase } from './supabase.js';
import { clearActiveTournamentId } from './tournament-context.js';

/**
 * Global Authentication Information
 * Replaces mock-data.js currentUser with real Supabase session data
 */

function getEmailLocalPart(email) {
  return String(email || '').split('@')[0].trim();
}

function formatNameFromEmail(email) {
  const localPart = getEmailLocalPart(email);
  if (!localPart) return 'User';

  return localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'User';
}

function isUsernameLike(value) {
  return /^[a-z0-9._-]+$/i.test(value) && /[0-9._]/.test(value) && !value.includes(' ');
}

function getDisplayName(user) {
  const emailLocalPart = getEmailLocalPart(user.email).toLowerCase();
  const candidates = [
    user.user_metadata?.full_name,
    user.user_metadata?.name,
    user.user_metadata?.display_name
  ];

  for (const candidate of candidates) {
    const name = String(candidate || '').trim();
    if (!name || name.includes('@')) continue;

    const lowerName = name.toLowerCase();
    if (isUsernameLike(name) && lowerName !== emailLocalPart) continue;

    return name;
  }

  return formatNameFromEmail(user.email);
}

function getInitials(name) {
  return String(name || 'User')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const name = getDisplayName(user);

  return {
    id: user.id,
    name,
    email: user.email,
    initials: getInitials(name),
    role: user.user_metadata?.role || 'Guest'
  };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  clearActiveTournamentId();
  window.location.hash = '/'; // Go to login/landing
}
