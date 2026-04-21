import { icon } from '../components/icons.js';
import { supabase } from '../lib/supabase.js';

export function renderSignup(container, navigate) {
  container.className = '';
  
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__logo">
          <div style="width: 48px; height: 48px; margin: 0 auto; color: #0038A8;">${icon('logo', 48)}</div>
        </div>
        <h1 class="auth-card__title">Create an account</h1>
        <p class="auth-card__subtitle">Join Tabracadabra to manage tournaments and track performance</p>
        
        <button id="google-signup" class="auth-google-btn auth-google-btn--massive">
          ${icon('google', 24)}
          Sign up with Google
        </button>
        
        <div class="auth-divider">
          <span>OR SIGN UP WITH EMAIL</span>
        </div>
        
        <form id="signup-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="signup-name" class="form-input" placeholder="Your full name" required />
          </div>

          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="signup-email" class="form-input" placeholder="you@example.com" required />
          </div>
          
          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="password-wrapper">
              <input type="password" id="signup-password" class="form-input" placeholder="At least 8 characters" required />
              <div id="password-toggle" class="password-toggle">
                ${icon('eye', 18)}
              </div>
            </div>
          </div>

          <div class="form-group mb-lg">
            <label class="form-label">Confirm Password</label>
            <div class="password-wrapper">
              <input type="password" id="signup-confirm-password" class="form-input" placeholder="Confirm your password" required />
              <div id="confirm-password-toggle" class="password-toggle">
                ${icon('eye', 18)}
              </div>
            </div>
          </div>
          
          <button type="submit" id="submit-btn" class="auth-submit-btn" style="background: #0038A8;">Create account</button>
        </form>
        
        <div id="resend-container" style="display: none; margin-top: 20px; padding: 12px; background: rgba(0, 56, 168, 0.05); border-radius: 8px; font-size: 14px;">
          Didn't get the email? <a href="javascript:void(0)" id="resend-btn" style="color: #0038A8; font-weight: 600;">Resend confirmation</a>
        </div>

        <div class="auth-footer" style="margin-top: 32px;">
          Already have an account? <a href="#/">Sign in</a>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#signup-form');
  const nameInput = container.querySelector('#signup-name');
  const emailInput = container.querySelector('#signup-email');
  const passwordInput = container.querySelector('#signup-password');
  const confirmPasswordInput = container.querySelector('#signup-confirm-password');
  const toggleBtn = container.querySelector('#password-toggle');
  const confirmToggleBtn = container.querySelector('#confirm-password-toggle');
  const googleBtn = container.querySelector('#google-signup');
  const submitBtn = container.querySelector('#submit-btn');

  // Password Visibility Toggle
  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.innerHTML = isPassword ? icon('eyeOff', 18) : icon('eye', 18);
  });

  confirmToggleBtn.addEventListener('click', () => {
    const isPassword = confirmPasswordInput.type === 'password';
    confirmPasswordInput.type = isPassword ? 'text' : 'password';
    confirmToggleBtn.innerHTML = isPassword ? icon('eyeOff', 18) : icon('eye', 18);
  });

  // Google Sign Up
  googleBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
  });

  // Email/Password Sign Up
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (passwordInput.value !== confirmPasswordInput.value) {
      alert("Passwords do not match!");
      return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Creating account...';
    submitBtn.disabled = true;

    try {
      const { error } = await supabase.auth.signUp({
        email: emailInput.value,
        password: passwordInput.value,
        options: {
          data: {
            full_name: nameInput.value
          }
        }
      });

      if (!error) {
        alert('Success! Check your email for a confirmation link.');
        container.querySelector('#resend-container').style.display = 'block';
        navigate('/');
      } else {
        alert(error.message);
      }
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    } catch (err) {
      alert(err.message);
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });

  // Resend Logic
  const resendBtn = container.querySelector('#resend-btn');
  resendBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email) {
      alert("Please enter your email first.");
      return;
    }

    resendBtn.innerHTML = 'Sending...';
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email
    });

    if (error) {
      alert(error.message);
      resendBtn.innerHTML = 'Resend confirmation';
    } else {
      alert('Confirmation email resent! Please check your inbox.');
      resendBtn.innerHTML = 'Resend confirmation';
    }
  });
}
