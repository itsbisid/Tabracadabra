import { icon } from '../components/icons.js';

export function renderLanding(container) {
  container.className = 'layout-public anim-fade-in';
  container.innerHTML = `
    <div class="wizard-particles" id="landing-particles"></div>
    <header class="landing-header">
      <div class="landing-header__logo" style="display:flex; align-items:center; gap:8px;">
        <div class="sidebar__logo-icon" style="color:#0F2B5B; width:32px; height:32px;">${icon('logo', 32)}</div>
        <div>
          <div class="landing-header__logo-text" style="color:#0F2B5B; font-family: 'Poppins', sans-serif; text-transform: lowercase; font-size: 24px; font-weight: 500; letter-spacing: -0.5px; line-height:1;">tabracadabra</div>
          <div class="landing-header__logo-sub" style="font-size:10px; margin-top:2px;">Debate Suite</div>
        </div>
      </div>
      <nav class="landing-header__nav">
        <a href="#/tournaments" class="landing-header__nav-link">Tournaments</a>
        <a href="#/login" class="landing-header__nav-link landing-header__nav-link--login">Log in</a>
        <a href="#/signup" class="landing-header__nav-link landing-header__nav-link--signup">Sign up</a>
      </nav>
    </header>

    <main style="position: relative; z-index: 1;">
      <section class="landing-hero anim-stagger">
        <div class="text-center">
          <div class="landing-hero__badge">
            <span style="font-size: 1.2em;">✨</span> The next generation of debate operations
          </div>
          <h1 class="landing-hero__title">
            Conjure your entire tournament from one <span>magical workspace.</span>
          </h1>
          <p class="landing-hero__desc mx-auto">
            Built for convenors, tab, adjudication cores, and teams. From registration to finals, every round transition, ballot, and public update lives in one connected flow.
          </p>
          
          <div class="landing-hero__actions justify-center">
            <a href="#/create-tournament" class="btn btn--primary btn--lg" style="font-size: 1.1rem; padding: 16px 32px; border-radius: 999px;">
              Start your tournament <span style="margin-left: 8px;">→</span>
            </a>
            <a href="#/tournaments" class="btn btn--outline btn--lg" style="border-radius: 999px;">
              Explore live events
            </a>
          </div>

          <div class="landing-hero__features justify-center">
            <div class="landing-hero__feature">
              <span class="landing-hero__feature-icon">${icon('checkCircle')}</span>
              Format-flexible round progression
            </div>
            <div class="landing-hero__feature">
              <span class="landing-hero__feature-icon">${icon('checkCircle')}</span>
              Hall publishing and public panels
            </div>
            <div class="landing-hero__feature">
              <span class="landing-hero__feature-icon">${icon('checkCircle')}</span>
              Mobile e-ballots and feedback
            </div>
          </div>
        </div>
      </section>

      <section class="landing-section landing-section--alt">
        <h2 class="landing-section__title">Built for real tournament workflows</h2>
        <p class="landing-section__desc">Beyond tabulation, TabraCadabra covers operational coordination, communication, publishing, and result transparency.</p>
        
        <div class="landing-features-grid">
          <div class="landing-feature-card">
            <div class="landing-feature-card__icon">${icon('calendar')}</div>
            <h3 class="landing-feature-card__title">Tournament command center</h3>
            <p class="landing-feature-card__desc">Plan rounds, run live check-ins, release draws, track ballots, and progress from prelims to finals with a clear control flow.</p>
          </div>
          
          <div class="landing-feature-card">
            <div class="landing-feature-card__icon">${icon('users')}</div>
            <h3 class="landing-feature-card__title">People and institutions</h3>
            <p class="landing-feature-card__desc">Manage teams, adjudicators, institutions, and venue logistics in one place without fragmented spreadsheets.</p>
          </div>
          
          <div class="landing-feature-card">
            <div class="landing-feature-card__icon">${icon('barChart')}</div>
            <h3 class="landing-feature-card__title">Results and analytics</h3>
            <p class="landing-feature-card__desc">Speaker tab, team standings, adjudicator performance, and tournament insights designed for post-round decisions.</p>
          </div>
          
          <div class="landing-feature-card">
            <div class="landing-feature-card__icon">${icon('wifi')}</div>
            <h3 class="landing-feature-card__title">Live public broadcasting</h3>
            <p class="landing-feature-card__desc">Publish draw, check-in, break, and status panels for participants and audience with secure hall links.</p>
          </div>
          
          <div class="landing-feature-card">
            <div class="landing-feature-card__icon">${icon('mic')}</div>
            <h3 class="landing-feature-card__title">Mobile-first ballots</h3>
            <p class="landing-feature-card__desc">Adjudicators can submit ballots and feedback directly from phones using private links with a streamlined flow.</p>
          </div>
          
          <div class="landing-feature-card">
            <div class="landing-feature-card__icon">${icon('shield')}</div>
            <h3 class="landing-feature-card__title">Fairness by design</h3>
            <p class="landing-feature-card__desc">Conflict-aware allocation, role-aware permissions, and controlled round progression to keep competitive integrity high.</p>
          </div>
        </div>
      </section>

      <section class="landing-stats" style="border-bottom: 1px solid var(--color-border); padding-bottom: 4rem;">
        <div class="landing-stat">
          <div class="landing-stat__value">14+</div>
          <div class="landing-stat__label">Major formats</div>
        </div>
        <div class="landing-stat">
          <div class="landing-stat__value">100%</div>
          <div class="landing-stat__label">Prelims to finals</div>
        </div>
        <div class="landing-stat">
          <div class="landing-stat__value">Live</div>
          <div class="landing-stat__label">Real-time updates</div>
        </div>
        <div class="landing-stat">
          <div class="landing-stat__value">8</div>
          <div class="landing-stat__label">Role-based access</div>
        </div>
      </section>

      <section class="landing-cta">
        <div class="landing-cta__card">
          <h2 class="landing-cta__title">Upgrade your tournament operations</h2>
          <p class="text-muted mb-xl" style="font-size: 1.1rem">Join convenors worldwide running events on TabraCadabra.</p>
          <div class="landing-cta__actions">
            <a href="#/signup" class="btn btn--primary btn--lg">Create account</a>
            <a href="#/tournaments" class="btn btn--outline btn--lg">View tournaments</a>
          </div>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px;">
        <div class="sidebar__logo-icon" style="width: 24px; height: 24px; color:#0F2B5B;">${icon('logo', 24)}</div>
        <span style="color:#0F2B5B; font-family: 'Poppins', sans-serif; text-transform: lowercase; font-size: 18px; font-weight: 500; letter-spacing: -0.5px;">tabracadabra</span>
      </div>
      <div>&copy; 2026 TabraCadabra — Debate operations and tabulation suite.</div>
    </footer>
  `;

  // Add floating particles for magic theme
  setTimeout(() => {
    const container = document.getElementById('landing-particles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'wizard-particle';
      particle.style.left = (Math.random() * 100) + '%';
      particle.style.top = (Math.random() * 100) + '%';
      particle.style.animationDelay = (Math.random() * 5) + 's';
      particle.style.background = i % 3 === 0 ? 'var(--color-primary)' : 'var(--color-gold-light)';
      container.appendChild(particle);
    }
  }, 100);
}
