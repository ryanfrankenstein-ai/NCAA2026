# 🏀 March Madness 2026 — Live Bracket Tracker

A live, self-updating March Madness tracker for the 2026 NCAA D1 Men's Basketball Tournament. Built as a static site — no backend required.

## Features

- **Live Bracket** — Full 64-team bracket with all 4 regions (East, West, South, Midwest). Click teams to mark winners. State saves to your browser.
- **Live Scores** — Auto-refreshes every 30 seconds using ESPN's public scoreboard API. Shows in-progress scores, final results, and upcoming games.
- **Group Standings** — Track your Yahoo Fantasy bracket group (#20048). Manually enter scores from your Yahoo group page and they save locally.
- **First Four** — All 4 First Four matchups included with proper bracket advancement.

## Deploy to Render (from GitHub)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/march-madness-2026.git
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com) and sign in
2. Click **New** → **Static Site**
3. Connect your GitHub repo
4. Settings:
   - **Name:** march-madness-2026 (or anything you want)
   - **Build Command:** *(leave blank)*
   - **Publish Directory:** `.`
5. Click **Create Static Site**

Render will auto-deploy every time you push to GitHub. Your site will be live at `https://your-site-name.onrender.com`.

## Live Score Source

Scores come from ESPN's public (undocumented) API:
```
https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=50
```

This requires a CORS proxy for browser requests. The app uses `api.allorigins.win` as a CORS proxy automatically.

## Updating Group Standings

Since Yahoo Fantasy requires login, standings are entered manually:
1. Open the **Group Standings** tab
2. Click **→ Open Yahoo Group** to open your group in a new tab
3. Enter each participant's name, points, max possible points, and correct picks
4. Click **Save Standings**

Standings save to your browser's localStorage and persist across refreshes.

## File Structure

```
├── index.html    — Main HTML layout
├── style.css     — All styles
├── data.js       — 2026 bracket teams & matchup data
├── app.js        — Application logic (scoring, rendering, API calls)
├── render.yaml   — Render deployment configuration
└── README.md     — This file
```

## Tech Stack

- Pure HTML/CSS/JavaScript — no build step, no dependencies
- ESPN public scoreboard API for live scores
- `localStorage` for bracket picks and standings persistence
- Google Fonts (Bebas Neue, DM Sans, Roboto Mono)
