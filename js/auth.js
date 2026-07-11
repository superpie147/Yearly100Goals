// Authentication helpers wrapping supabase.auth.
import { supabase } from './config.js';

// Clean OAuth artifacts out of the URL after supabase-js parses the session.
// With hash routing, Supabase (implicit flow) can dump tokens into location.hash,
// and PKCE puts ?code=...&state=... into the query string. We strip both while
// preserving any app hash route the user was returning to.
export function cleanAuthUrlArtifacts() {
  try {
    const url = new URL(window.location.href);
    let dirty = false;

    // PKCE query params.
    if (url.searchParams.has('code') || url.searchParams.has('state')) {
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      dirty = true;
    }

    // Implicit-flow tokens can land in the hash (access_token=...).
    if (url.hash.includes('access_token') || url.hash.includes('error_description')) {
      url.hash = '';
      dirty = true;
    }

    if (dirty) {
      const cleaned = url.pathname + url.search + url.hash;
      window.history.replaceState({}, document.title, cleaned || url.pathname);
    }
  } catch (_) {
    /* best-effort */
  }
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function signInWithGoogle() {
  // Return to the app root; the router will pick up from there.
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
