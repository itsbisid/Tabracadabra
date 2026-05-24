<div align="center">
  <img src="public/banner.png" alt="TabraCadabra Banner" width="100%" style="border-radius: 12px; margin-bottom: 20px;" />
  
  # 📊 TabraCadabra
  ### The Ultimate Competitive Debate Suite
  
  **Run entire tournaments from one modern workspace. Built for convenors, tab, adjudication cores, and teams.**

  [Features](#-key-features) • [Tech Stack](#-tech-stack) • [Structure](#-project-structure) • [Getting Started](#-getting-started)
</div>

<br />

---

## 🚀 Overview

**TabraCadabra** is a comprehensive, all-in-one platform designed to streamline the complexities of competitive debating. Whether you are a tournament director managing logistics, a tab officer running rounds, or a debater tracking your competitive journey, TabraCadabra provides the tools you need in a sleek, high-performance interface.

## ✨ Key Features

### 🏛️ For Convenors & Organizers
- **One-Click Tournament Creation**: Fully customizable setup for any debate format.
- **Smart Registration**: Generate public registration links with secure token-based access.
- **Venue Management**: Track and assign physical or digital rooms.
- **Adjudicator Coordination**: Manage pool eligibility, clashes, and feedback.

### 📈 For the Tab Room
- **Automated Standings**: Real-time calculations for team points and speaker scores.
- **Round Management**: Easy motion release and round scheduling.
- **The Break**: Dynamic tracking of team breaks and speaker tabs.
- **Digital Ballots**: Seamless feedback and score submission flow.

### 👤 For Participants
- **The Journey (Resume)**: A permanent record of your tournament history, break rates, and cumulative speaks.
- **Live Tournament Dashboard**: Real-time access to motions, announcements, and pairings.
- **Communication Suite**: Integrated chat and "Voice Rooms" for prep and socialization.

## 🛠️ Tech Stack

- **Frontend**: [Vite](https://vitejs.dev/) + Vanilla JavaScript (Modern ES6+)
- **Styling**: Vanilla CSS with a custom design system
- **Backend/Database**: [Supabase](https://supabase.com/) (Auth, Database, Edge Functions)
- **Typography**: Inter & Poppins via Google Fonts

## 📁 Project Structure

```text
├── js/
│   ├── components/     # Reusable UI elements (Modals, Nav, Cards)
│   ├── data/           # Constants and configuration
│   ├── lib/            # Supabase client and shared utilities
│   ├── pages/          # Page-specific logic and renders
│   │   ├── tournament/ # Management-specific views (Tab, Teams, etc.)
│   │   └── ...         # Core user views (Dashboard, Profile)
│   └── app.js          # Main router and app gateway
├── public/             # Static assets and images
├── style.css           # Global design system and component styles
├── index.html          # Entry point
└── package.json        # Dependencies and scripts
```

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- A Supabase project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/itsbisid/Tabracadabra.git
   cd Tabracadabra
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root and add your Supabase and Resend credentials:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   RESEND_API_KEY=your_resend_api_key
   RESEND_FROM_EMAIL=TabraCadabra <noreply@your-domain.com>
   RESEND_REPLY_TO=support@your-domain.com
   ```
   Keep `RESEND_API_KEY` server-side only. Do not prefix it with `VITE_`.

4. **Launch Development Server**
   ```bash
   npm run dev
   ```

---

<div align="center">
  <p>Built with ❤️ by the TabraCadabra Team</p>
</div>

