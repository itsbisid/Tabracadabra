import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';
import { getGoogleOAuthBlockedMessage, isGoogleOAuthUnsupportedBrowser, signInWithGoogle } from '../lib/oauth-browser.js';

export function renderLogin(container, navigate) {
  container.className = '';
  
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__logo">
          <div style="width: 48px; height: 48px; margin: 0 auto; color: #0038A8;">${icon('logo', 48)}</div>
        </div>
        <h1 class="auth-card__title">Welcome back</h1>
        <p class="auth-card__subtitle">Sign in to your Tabracadabra account</p>
        
        <button id="google-signin" class="auth-google-btn auth-google-btn--massive">
          ${icon('google', 24)}
          Sign in with Google
        </button>
        <p id="oauth-notice" class="auth-notice" hidden></p>
        
        <div class="auth-divider">
          <span>OR SIGN IN WITH EMAIL</span>
        </div>
        
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="login-email" class="form-input" placeholder="you@example.com" required />
          </div>
          
          <div class="form-group mb-lg">
            <label class="form-label">Password</label>
            <div class="password-wrapper">
              <input type="password" id="login-password" class="form-input" placeholder="Enter your password" required />
              <div id="password-toggle" class="password-toggle">
                ${icon('eye', 18)}
              </div>
            </div>
          </div>
          
          <button type="submit" id="submit-btn" class="auth-submit-btn" style="background: #0038A8;">Sign in</button>
        </form>
        
        <div class="auth-footer" style="margin-top: 32px;">
          Don't have an account? <a href="#/signup">Sign up</a>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const emailInput = container.querySelector('#login-email');
  const passwordInput = container.querySelector('#login-password');
  const toggleBtn = container.querySelector('#password-toggle');
  const googleBtn = container.querySelector('#google-signin');
  const submitBtn = container.querySelector('#submit-btn');
  const oauthNotice = container.querySelector('#oauth-notice');

  function showOAuthNotice(message) {
    oauthNotice.textContent = message;
    oauthNotice.hidden = false;
  }

  if (isGoogleOAuthUnsupportedBrowser()) {
    googleBtn.disabled = true;
    showOAuthNotice(getGoogleOAuthBlockedMessage());
  }

  // Password Visibility Toggle
  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.innerHTML = isPassword ? icon('eyeOff', 18) : icon('eye', 18);
  });

  // Google Sign In
  googleBtn.addEventListener('click', async () => {
    oauthNotice.hidden = true;
    const originalText = googleBtn.innerHTML;
    googleBtn.innerHTML = 'Opening Google...';
    googleBtn.disabled = true;

    const { error } = await signInWithGoogle(supabase);
    if (error) {
      showOAuthNotice(error.message);
      googleBtn.innerHTML = originalText;
      googleBtn.disabled = isGoogleOAuthUnsupportedBrowser();
    }
  });

  // Email/Password Sign In
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Signing in...';
    submitBtn.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.value,
      password: passwordInput.value
    });

    if (error) {
      alert(error.message);
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    } else {
      navigate('/dashboard');
    }
  });
}
