// ============================================================
// March Madness 2026 — App Logic
// ============================================================

const ESPN_SCORES_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=50';

let bracketState = {};
let standingsData = [];
let refreshInterval = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadBracketState();
  loadStandings();
  renderBracket();
  renderStandingsEditor();
  fetchScores();
  startAutoRefresh();
});

// ── Tab Navigation ───────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  event.target.classList.add('active');
}

// ── Auto Refresh ─────────────────────────────────────────
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(fetchScores, 30000); // every 30s
}

// ── ESPN Score Fetching ───────────────────────────────────
async function fetchScores() {
  const btn = document.getElementById('refreshBtn');
  btn.textContent = '↻ Loading…';
  btn.disabled = true;

  try {
    // Use a CORS proxy for browser-side requests
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const targetUrl = encodeURIComponent(ESPN_SCORES_URL);
    const response = await fetch(proxyUrl + targetUrl);
    if (!response.ok) throw new Error('Network error');
    const data = await response.json();
    renderScores(data);
    updateLastUpdated();
  } catch (err) {
    console.warn('ESPN fetch failed, trying direct:', err);
    // Try direct (works on server-side / some browsers)
    try {
      const r2 = await fetch(ESPN_SCORES_URL);
      const data = await r2.json();
      renderScores(data);
      updateLastUpdated();
    } catch (err2) {
      document.getElementById('scoresGrid').innerHTML = `
        <div class="error-msg">
          <p>⚠️ Could not load live scores automatically.</p>
          <p>Check scores at: <a href="https://www.espn.com/mens-college-basketball/scoreboard" target="_blank">ESPN Scoreboard</a></p>
        </div>`;
    }
  }

  btn.textContent = '↻ Refresh';
  btn.disabled = false;
}

function renderScores(data) {
  const grid = document.getElementById('scoresGrid');
  const events = (data.events || []).filter(e => {
    // Filter for tournament games only
    const name = (e.name || '').toLowerCase();
    const notes = (e.notes || []).map(n => n.headline || '').join(' ').toLowerCase();
    return notes.includes('tournament') || notes.includes('ncaa') || true;
  });

  if (!events.length) {
    grid.innerHTML = '<div class="no-games">No games currently scheduled. Check back during the tournament!</div>';
    return;
  }

  grid.innerHTML = events.map(event => {
    const comp = event.competitions?.[0];
    if (!comp) return '';
    const home = comp.competitors?.find(t => t.homeAway === 'home');
    const away = comp.competitors?.find(t => t.homeAway === 'away');
    const status = comp.status?.type;
    const statusName = status?.shortDetail || status?.description || '';
    const isLive = status?.state === 'in';
    const isFinal = status?.completed;
    const headline = event.notes?.[0]?.headline || '';

    const teamCard = (team) => {
      if (!team) return '';
      const score = team.score || '—';
      const name = team.team?.shortDisplayName || team.team?.displayName || '';
      const seed = team.curatedRank?.current || '';
      const logo = team.team?.logo || '';
      const winner = team.winner;
      return `
        <div class="team-row ${winner ? 'winner' : ''}">
          ${logo ? `<img src="${logo}" class="team-logo" alt="${name}" onerror="this.style.display='none'">` : '<div class="team-logo-placeholder"></div>'}
          <span class="team-seed">${seed}</span>
          <span class="team-name">${name}</span>
          <span class="team-score ${isLive ? 'live-score' : ''}">${score}</span>
        </div>`;
    };

    return `
      <div class="score-card ${isLive ? 'live' : ''} ${isFinal ? 'final' : ''}">
        ${headline ? `<div class="game-round">${headline}</div>` : ''}
        ${teamCard(away)}
        ${teamCard(home)}
        <div class="game-status ${isLive ? 'status-live' : ''}">${isLive ? '🔴 ' : ''}${statusName}</div>
      </div>`;
  }).join('');

  // Also update the live badge
  const hasLive = events.some(e => e.competitions?.[0]?.status?.type?.state === 'in');
  document.getElementById('liveBadge').style.display = hasLive ? 'flex' : 'none';
}

function updateLastUpdated() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('lastUpdated').textContent = `Updated ${time}`;
}

// ── Bracket Rendering ─────────────────────────────────────
function renderBracket() {
  Object.entries(BRACKET_DATA.regions).forEach(([key, region]) => {
    const container = document.getElementById('region-' + key);
    container.innerHTML = `
      <div class="region-title">
        <span class="region-name">${region.name}</span>
        <span class="region-loc">${region.location}</span>
      </div>
      <div class="matchups-list">
        ${region.matchups.map(m => renderMatchup(m, key)).join('')}
      </div>`;
  });

  renderFinalFour();
}

function renderMatchup(matchup, regionKey) {
  const winnerId = bracketState[matchup.id] || null;
  const t1 = matchup.r1;
  const t2 = matchup.r2;

  const teamBtn = (team, side) => {
    const tid = `${matchup.id}-${side}`;
    const isWinner = winnerId === tid;
    const isFF = team.firstFour;
    const ffWinner = isFF ? (bracketState['firstFour_' + team.firstFour] || null) : null;
    const displayName = ffWinner || team.name;
    return `
      <button class="team-btn ${isWinner ? 'selected' : ''} ${isFF ? 'first-four' : ''}"
              onclick="toggleWinner('${matchup.id}', '${tid}', '${regionKey}')"
              title="${isFF ? 'First Four qualifier' : team.record}">
        <span class="seed-badge">${team.seed}</span>
        <span class="btn-name">${displayName}</span>
        ${team.record !== 'TBD' ? `<span class="btn-record">${team.record}</span>` : ''}
        ${isWinner ? '<span class="check">✓</span>' : ''}
      </button>`;
  };

  return `
    <div class="matchup" data-id="${matchup.id}">
      ${teamBtn(t1, 'r1')}
      <div class="vs-divider">vs</div>
      ${teamBtn(t2, 'r2')}
    </div>`;
}

function toggleWinner(matchupId, teamId, regionKey) {
  if (bracketState[matchupId] === teamId) {
    delete bracketState[matchupId];
  } else {
    bracketState[matchupId] = teamId;
  }
  saveBracketState();
  renderBracket();
}

function renderFinalFour() {
  const container = document.getElementById('final-four');
  // Collect region winners
  const regions = ['east', 'west', 'south', 'midwest'];
  const slots = regions.map(r => {
    const regionData = BRACKET_DATA.regions[r];
    // Find the last matchup winner (seed 1 vs 2 bracket)
    return { region: r, label: regionData.name };
  });

  container.innerHTML = `
    <div class="ff-slots">
      ${slots.map(s => `
        <div class="ff-slot">
          <div class="ff-region-label">${s.label} Winner</div>
          <div class="ff-team-display" id="ff-${s.region}">${getFinalFourTeam(s.region)}</div>
        </div>
      `).join('')}
    </div>
    <div class="championship-slot">
      <div class="champ-label">🏆 National Champion</div>
      <input type="text" id="champPick" class="champ-input" 
             placeholder="Enter champion pick…"
             value="${bracketState['champion'] || ''}"
             onchange="saveChampion(this.value)" />
    </div>`;
}

function getFinalFourTeam(region) {
  return bracketState['ff_' + region] || '<span class="tbd">TBD</span>';
}

function saveChampion(val) {
  bracketState['champion'] = val;
  saveBracketState();
}

// ── Bracket State Persistence ─────────────────────────────
function saveBracketState() {
  localStorage.setItem('mm2026_bracket', JSON.stringify(bracketState));
}

function loadBracketState() {
  try {
    const saved = localStorage.getItem('mm2026_bracket');
    bracketState = saved ? JSON.parse(saved) : {};
  } catch {
    bracketState = {};
  }
}

// ── Standings ─────────────────────────────────────────────
const DEFAULT_STANDINGS = [
  { name: 'You', pts: 0, maxPts: 192, correct: 0 },
  { name: 'Friend 1', pts: 0, maxPts: 192, correct: 0 },
  { name: 'Friend 2', pts: 0, maxPts: 192, correct: 0 },
  { name: 'Friend 3', pts: 0, maxPts: 192, correct: 0 },
];

function loadStandings() {
  try {
    const saved = localStorage.getItem('mm2026_standings');
    standingsData = saved ? JSON.parse(saved) : DEFAULT_STANDINGS;
  } catch {
    standingsData = [...DEFAULT_STANDINGS];
  }
  renderStandingsList();
}

function saveStandings() {
  const rows = document.querySelectorAll('.editor-row');
  standingsData = Array.from(rows).map(row => ({
    name: row.querySelector('.inp-name').value,
    pts: parseInt(row.querySelector('.inp-pts').value) || 0,
    maxPts: parseInt(row.querySelector('.inp-max').value) || 192,
    correct: parseInt(row.querySelector('.inp-correct').value) || 0,
  }));
  // Sort by points
  standingsData.sort((a, b) => b.pts - a.pts);
  localStorage.setItem('mm2026_standings', JSON.stringify(standingsData));
  renderStandingsList();
  renderStandingsEditor();
  showSaveFlash();
}

function addParticipant() {
  standingsData.push({ name: 'New Player', pts: 0, maxPts: 192, correct: 0 });
  renderStandingsEditor();
}

function removeParticipant(idx) {
  standingsData.splice(idx, 1);
  renderStandingsEditor();
}

function renderStandingsList() {
  const list = document.getElementById('standingsList');
  if (!list) return;
  const sorted = [...standingsData].sort((a, b) => b.pts - a.pts);
  list.innerHTML = sorted.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const pct = Math.round((p.pts / (p.maxPts || 192)) * 100);
    return `
      <div class="standing-row ${i === 0 ? 'leader' : ''}">
        <span class="rank">${medal}</span>
        <span class="s-name">${p.name}</span>
        <span class="s-pts"><strong>${p.pts}</strong></span>
        <span class="s-max">${p.maxPts}</span>
        <span class="s-correct">${p.correct}</span>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

function renderStandingsEditor() {
  const grid = document.getElementById('editorGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="editor-header">
      <span>Name</span><span>Points</span><span>Max Pts</span><span>Correct</span><span></span>
    </div>
    ${standingsData.map((p, i) => `
      <div class="editor-row">
        <input class="inp-name" value="${p.name}" placeholder="Name" />
        <input class="inp-pts" type="number" value="${p.pts}" min="0" max="999" />
        <input class="inp-max" type="number" value="${p.maxPts}" min="0" max="999" />
        <input class="inp-correct" type="number" value="${p.correct}" min="0" max="63" />
        <button class="btn-remove" onclick="removeParticipant(${i})">✕</button>
      </div>`).join('')}`;
}

function showSaveFlash() {
  const btn = document.querySelector('.btn-save');
  btn.textContent = '✓ Saved!';
  btn.style.background = '#22c55e';
  setTimeout(() => {
    btn.textContent = 'Save Standings';
    btn.style.background = '';
  }, 2000);
}
