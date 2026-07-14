const IN_APP_BROWSER_PATTERN = /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|TikTok|Snapchat|Pinterest|DuckDuckGo|GSA|CriOS\/.*GSA/i;

function getUserAgent() {
  return window.navigator?.userAgent || '';
}

function isIOSWebView(userAgent) {
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent)
    || (window.navigator?.platform === 'MacIntel' && window.navigator?.maxTouchPoints > 1);
  const hasWebKit = /AppleWebKit/i.test(userAgent);
  const hasAllowedBrowserToken = /Safari|CriOS|FxiOS|EdgiOS/i.test(userAgent);

  return isIOS && hasWebKit && !hasAllowedBrowserToken;
}

function isAndroidWebView(userAgent) {
  return /; wv\)|\bwv\b|Version\/\d+(?:\.\d+)?.*Chrome\/.*Mobile Safari/i.test(userAgent);
}

export function isGoogleOAuthUnsupportedBrowser() {
  const userAgent = getUserAgent();
  return IN_APP_BROWSER_PATTERN.test(userAgent)
    || isIOSWebView(userAgent)
    || isAndroidWebView(userAgent);
}

export function getGoogleOAuthBlockedMessage() {
  return 'Google sign-in is blocked in this browser. Open Tabracadabra in Safari, Chrome, or another full browser, or sign in with email and password below.';
}

export async function signInWithGoogle(supabase) {
  if (isGoogleOAuthUnsupportedBrowser()) {
    return { error: new Error(getGoogleOAuthBlockedMessage()), blocked: true };
  }

  const redirectUrl = new URL(window.location.href);
  redirectUrl.hash = '';
  redirectUrl.search = '';

  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl.toString() }
  });
}
