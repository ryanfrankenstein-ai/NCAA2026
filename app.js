// ============================================================
// March Madness 2026 — App Logic
// ESPN auto-populates bracket results. No manual clicking needed.
// ============================================================

const ESPN_SCORES_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=50';
const ESPN_TOURNAMENT_URL = (date) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=50&dates=${date}`;

let espnResults = {};
let bracketWinners = {};
let standingsData = [];
let refreshInterval = null;
let allEspnGames = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchAllTournamentData();
  startAutoRefresh();
});

function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  event.target.classList.add('active');
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(fetchAllTournamentData, 30000);
}

async function fetchWithFallback(url) {
  const proxy = 'https://api.allorigins.win/raw?url=';
  try {
    const r = await fetch(proxy + encodeURIComponent(url));
    if (!r.ok) throw new Error('proxy fail');
    return await r.json();
  } catch {
    const r = await fetch(url);
    return await r.json();
  }
}

async function fetchAllTournamentData() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.textContent = '↻ Loading…'; btn.disabled = true; }

  const dates = ['20260317','20260318','20260319','20260320','20260321','20260322',
    '20260326','20260327','20260328','20260329','20260404','20260406'];

  let allGames = [];
  try {
    const fetches = [
      fetchWithFallback(ESPN_SCORES_URL),
      ...dates.map(d => fetchWithFallback(ESPN_TOURNAMENT_URL(d)).catch(() => ({ events: [] })))
    ];
    const results = await Promise.all(fetches);
    allGames = results.flatMap(d => d.events || []);
    const seen = new Set();
    allGames = allGames.filter(g => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
  } catch (err) {
    console.warn('ESPN fetch error:', err);
  }

  allEspnGames = allGames;
  processEspnResults(allGames);
  renderScores(allGames);
  renderBracket();
  initStandings();
  updateLastUpdated();

  if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
}

// gameResults[matchupId] = { t1: {name,score,winner,completed,isLive}, t2: {...} }
// This is the bracket's source of truth — populated by matching ESPN games to bracket matchups
let gameResults = {};

function processEspnResults(games) {
  espnResults = {};
  bracketWinners = {};
  gameResults = {};

  // First pass: index all ESPN teams by every name variant
  for (const event of games) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const status = comp.status?.type;
    const completed = status?.completed || false;
    const isLive = status?.state === 'in';
    const competitors = comp.competitors || [];

    for (const team of competitors) {
      const raw   = team.team?.displayName || '';
      const short = team.team?.shortDisplayName || '';
      const abbr  = team.team?.abbreviation || '';
      const entry = {
        winner: team.winner === true,
        score: team.score != null ? String(team.score) : null,
        completed,
        isLive,
        seed: team.curatedRank?.current || null,
        logo: team.team?.logo || '',
        espnShort: short,
        espnRaw: raw,
      };
      for (const n of [raw, short, abbr].filter(Boolean)) {
        espnResults[norm(n)] = entry;
      }
    }
  }

  // Second pass: for each bracket matchup, find the matching ESPN game
  // by looking for a game where BOTH teams (or at least one with winner=true) match
  const allMatchups = Object.values(BRACKET_DATA.regions).flatMap(r => r.matchups);
  for (const m of allMatchups) {
    const r1Names = getAllNameVariants(m.r1.name);
    const r2Names = getAllNameVariants(m.r2.name);

    // Find the ESPN game that contains one of r1's names AND one of r2's names
    let matchedGame = null;
    for (const event of games) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const teams = comp.competitors || [];
      const espnNames = teams.flatMap(t => [
        norm(t.team?.displayName || ''),
        norm(t.team?.shortDisplayName || ''),
        norm(t.team?.abbreviation || ''),
      ]).filter(Boolean);

      const hasR1 = r1Names.some(n => espnNames.includes(n));
      const hasR2 = r2Names.some(n => espnNames.includes(n));

      if (hasR1 || hasR2) {
        // For First Four matchups (combined slots like HOW/UMBC), match on either team
        if (m.r2.firstFour || m.r1.firstFour) {
          if (hasR1 || hasR2) { matchedGame = { event, comp }; break; }
        } else if (hasR1 && hasR2) {
          matchedGame = { event, comp }; break;
        } else if (hasR1 || hasR2) {
          // Partial — keep looking but save as fallback
          if (!matchedGame) matchedGame = { event, comp };
        }
      }
    }

    if (matchedGame) {
      const { comp } = matchedGame;
      const status = comp.status?.type;
      const completed = status?.completed || false;
      const isLive = status?.state === 'in';
      const teams = comp.competitors || [];

      // Check if this is a First Four placeholder matchup
      // e.g. "Michigan vs HOW/UMBC" — the ESPN game found is Howard vs UMBC (First Four)
      // We should NOT show that First Four score on the R64 bracket slot.
      // Instead, only record the winner so they can advance.
      const isFirstFourSlot = !!(m.r1.firstFour || m.r2.firstFour);

      // Verify this is truly the RIGHT game — both r1 AND r2 names must be present
      // (not just one via alias). For First Four slots, r2 is a placeholder so we
      // accept single-team match only for winner tracking, not score display.
      const r1inGame = r1Names.some(n => teams.some(t =>
        [norm(t.team?.displayName||""), norm(t.team?.shortDisplayName||""), norm(t.team?.abbreviation||"")].includes(n)
      ));
      const r2inGame = r2Names.some(n => teams.some(t =>
        [norm(t.team?.displayName||""), norm(t.team?.shortDisplayName||""), norm(t.team?.abbreviation||"")].includes(n)
      ));

      // Only show scores if BOTH actual teams are in this ESPN game
      // (prevents showing First Four scores on R64 slots, and prevents partial matches)
      const bothTeamsInGame = r1inGame && r2inGame;

      // Match each ESPN competitor to r1 or r2
      let r1espn = null, r2espn = null;
      for (const t of teams) {
        const tNames = [
          norm(t.team?.displayName || ''),
          norm(t.team?.shortDisplayName || ''),
          norm(t.team?.abbreviation || ''),
        ];
        const matchesR1 = r1Names.some(n => tNames.includes(n));
        const matchesR2 = r2Names.some(n => tNames.includes(n));
        const entry = {
          score: t.score != null ? String(t.score) : null,
          winner: t.winner === true,
          completed,
          isLive,
        };
        if (matchesR1) r1espn = entry;
        else if (matchesR2) r2espn = entry;
      }

      // For First Four slots: record the winner so they appear in R64, but don't show scores
      if (isFirstFourSlot) {
        // The winner of the First Four game becomes the seed in the R64 matchup
        // Find which bracket name maps to the winning ESPN team
        const winnerEntry = teams.find(t => t.winner === true);
        if (winnerEntry && completed) {
          const winnerNames = [
            norm(winnerEntry.team?.displayName || ''),
            norm(winnerEntry.team?.shortDisplayName || ''),
          ];
          // Check if winner matches r1 aliases (unlikely for First Four, r1 is usually the main seed)
          // More likely winner matches r2 (the First Four qualifier)
          const winnerIsR2 = r2Names.some(n => winnerNames.includes(n));
          const winnerIsR1 = r1Names.some(n => winnerNames.includes(n));
          if (winnerIsR2) bracketWinners[m.id + '_ff'] = winnerEntry.team?.shortDisplayName;
          if (winnerIsR1) bracketWinners[m.id + '_ff'] = winnerEntry.team?.shortDisplayName;
          // Don't set gameResults so no score shows on the R64 card
        }
        return; // Skip — First Four result shown in the First Four banner only
      }

      // For regular matchups: only store scores if we positively matched both teams
      if (bothTeamsInGame) {
        gameResults[m.id] = { completed, isLive, r1: r1espn, r2: r2espn };
        if (r1espn?.winner && completed) bracketWinners[m.id] = m.r1.name;
        else if (r2espn?.winner && completed) bracketWinners[m.id] = m.r2.name;
      }
    }
  }
}

// Get all name variants we should try matching for a bracket team name
function getAllNameVariants(bracketName) {
  if (!bracketName) return [];
  const n = norm(bracketName);
  const base = [n];

  const aliasMap = {
    'connecticut': ['uconn'],
    'uconn': ['connecticut'],
    'michigan st': ['michigan state', 'mich state'],
    'michigan state': ['michigan st', 'mich state'],
    'north dakota st': ['north dakota state', 'ndsu', 'n dakota state'],
    'n dak st': ['north dakota state', 'ndsu'],
    'cal baptist': ['california baptist'],
    'california baptist': ['cal baptist', 'cbaptist'],
    'northern iowa': ['n iowa', 'uni'],
    'south florida': ['usf', 's florida'],
    'high point': ['hi point', 'hpu'],
    'kennesaw st': ['kennesaw state'],
    'kennesaw state': ['kennesaw st'],
    "saint mary's": ["st mary's", 'saint marys'],
    'queens (nc)': ['queens university', 'queens university of charlotte'],
    'queens university': ['queens (nc)', 'queens nc'],
    'how/umbc': ['howard', 'umbc'],
    'umbc/how': ['umbc', 'howard', 'howard bison'],
    'pv/leh': ['prairie view', 'prairie view a&m', 'lehigh'],
    'lehigh/pvamu': ['lehigh', 'prairie view and m', 'prairie view'],
    'nc st/texas': ['nc state', 'north carolina state', 'texas longhorns', 'texas'],
    'tx/ncst': ['nc state', 'texas'],
    'moh/smu': ['miami oh', 'miami ohio', 'smu', 'southern methodist'],
    'smu/mia oh': ['smu', 'southern methodist', 'miami ohio', 'miami oh'],
    'miami (fl)': ['miami', 'miami fl', 'miami hurricanes'],
    'miami (oh)': ['miami oh', 'miami ohio'],
    'vcu': ['virginia commonwealth'],
    'virginia commonwealth': ['vcu'],
    'saint louis': ['st louis', 'slu'],
    'iowa st': ['iowa state'],
    'iowa state': ['iowa st'],
    'wright st': ['wright state'],
    'wright state': ['wright st'],
    'tennessee st': ['tennessee state'],
    'tennessee state': ['tennessee st', 'tenn state'],
    'long island': ['liu brooklyn', 'liu', 'long island university'],
    'liu brooklyn': ['long island', 'long island university'],
    'nc st': ['nc state', 'north carolina state'],
    'north carolina': ['unc', 'unc tar heels'],
    'texas a&m': ['texas a and m', 'texas am', 'texas a&m aggies'],
    'ucf': ['central florida', 'uc-f'],
    'byu': ['brigham young'],
  };

  const extra = aliasMap[n] || [];
  return [...new Set([...base, ...extra])];
}

function norm(name) {
  return (name || '').toLowerCase()
    .replace(/\./g,'')
    .replace(/&/g,'and')
    .replace(/\s+/g,' ')
    .trim();
}

// Build a looser match — try multiple variations to find ESPN result
function findEspnResult(bracketName) {
  if (!bracketName) return null;
  const n = norm(bracketName);

  // Direct lookup first
  if (espnResults[n]) return espnResults[n];

  // Try common bracket name -> ESPN name mappings
  const aliases = {
    'connecticut': ['uconn'],
    'uconn': ['connecticut'],
    'michigan state': ['mich state','mich st'],
    'north dakota state': ['n dakota state', 'ndsu'],
    'cal baptist': ['california baptist','cbaptist'],
    'northern iowa': ['n iowa'],
    'south florida': ['s florida','usf'],
    'high point': ['hi point'],
    'kennesaw state': ['kennesaw st','ksu'],
    "saint mary's": ["st mary's", 'saint marys', "st. mary's"],
    'queens (nc)': ['queens university','queens university of charlotte','queens nc'],
    "queens university": ['queens (nc)', 'queens nc'],
    'how/umbc': ['howard','umbc'],
    'umbc/how': ['umbc','howard'],
    'pv/leh': ['prairie view','prairie view a&m','lehigh'],
    'lehigh/pvamu': ['lehigh', 'prairie view'],
    'nc st/texas': ['nc state','texas'],
    'tx/ncst': ['nc state', 'texas'],
    'moh/smu': ['miami oh','miami ohio','smu'],
    'mod/smu': ['miami oh','miami ohio','smu'],
    'miami (fl)': ['miami fl', 'miami'],
    'miami (oh)': ['miami oh', 'miami ohio'],
    'virginia commonwealth': ['vcu'],
    'vcu': ['virginia commonwealth'],
    'saint louis': ['st louis','slu'],
    'iowa state': ['iowa st'],
    'iowa st': ['iowa state'],
    'n dak st': ['north dakota state', 'ndsu'],
    'wright state': ['wright st'],
    'tennessee state': ['tenn state','tenn st'],
    'long island': ['liu brooklyn','liu','long island university'],
    'liu brooklyn': ['long island','long island university'],
  };

  const found = aliases[n];
  if (found) {
    for (const alias of found) {
      if (espnResults[alias]) return espnResults[alias];
    }
  }

  // Partial match fallback — if any key starts with first word of bracket name
  const firstWord = n.split(' ')[0];
  if (firstWord.length > 4) {
    for (const [key, val] of Object.entries(espnResults)) {
      if (key.startsWith(firstWord)) return val;
    }
  }

  return null;
}

// ── Render Scores ─────────────────────────────────────────
function renderScores(games) {
  const grid = document.getElementById('scoresGrid');
  if (!grid) return;

  if (!games.length) {
    grid.innerHTML = '<div class="no-games">No tournament games found yet — ESPN data will populate here once the tournament begins (First Four: Mar 17).</div>';
    return;
  }

  // Sort order:
  //   0 = live (in-progress)
  //   1 = recently finished (within last 60 min) — stays near top
  //   2 = upcoming (pre-game)
  //   3 = older completed games
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  const stateOrder = (e) => {
    const comp = e.competitions?.[0];
    const state = comp?.status?.type?.state;
    if (state === 'in') return 0;
    if (comp?.status?.type?.completed) {
      // Check if game ended within the last hour using the event date as proxy
      // ESPN doesn't always give end time, so we use date + ~2.5hr game length estimate
      const startTime = e.date ? new Date(e.date).getTime() : 0;
      const estimatedEnd = startTime + (2.5 * 60 * 60 * 1000);
      const recentlyFinished = (now - estimatedEnd) < ONE_HOUR;
      return recentlyFinished ? 1 : 3;
    }
    return 2; // pre-game upcoming
  };

  const sorted = [...games].sort((a, b) => {
    const sDiff = stateOrder(a) - stateOrder(b);
    if (sDiff !== 0) return sDiff;
    const aDate = a.date || '', bDate = b.date || '';
    const order = stateOrder(a);
    if (order === 0 || order === 1) return aDate.localeCompare(bDate); // live/recent: earliest first
    if (order === 2) return aDate.localeCompare(bDate);  // upcoming: soonest first
    return bDate.localeCompare(aDate); // old completed: most recent first
  });

  grid.innerHTML = sorted.map(event => {
    const comp = event.competitions?.[0];
    if (!comp) return '';
    const teams = comp.competitors || [];
    const away = teams.find(t => t.homeAway === 'away') || teams[0];
    const home = teams.find(t => t.homeAway === 'home') || teams[1];
    const status = comp.status?.type;
    const statusText = status?.shortDetail || status?.description || '';
    const isLive = status?.state === 'in';
    const isFinal = status?.completed;
    const headline = event.notes?.[0]?.headline || '';

    const teamRow = (team) => {
      if (!team) return '';
      const score = (isFinal || isLive) ? (team.score ?? '—') : '';
      const name = team.team?.shortDisplayName || team.team?.displayName || '';
      const seed = team.curatedRank?.current || '';
      const logo = team.team?.logo || '';
      const won = team.winner === true;
      return `<div class="team-row${won?' winner':''}">
        ${logo?`<img src="${logo}" class="team-logo" alt="" onerror="this.style.display='none'">` : '<span class="team-logo-ph"></span>'}
        ${seed?`<span class="team-seed">${seed}</span>`:''}
        <span class="team-name">${name}</span>
        <span class="team-score${isLive?' live-score':''}">${score}</span>
      </div>`;
    };

    const isUpcoming = status?.state === 'pre';
    // For upcoming games, convert the game time to Central time
    let gameTimeDisplay = '';
    if (isUpcoming && event.date) {
      const d = new Date(event.date);
      gameTimeDisplay = d.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZoneName: 'short'
      });
    }

    // statusText from ESPN for live/final games (period, clock, "Final", etc.)
    // For upcoming games, replace ESPN's time (which is ET) with our CT conversion
    const displayStatus = isUpcoming && gameTimeDisplay ? gameTimeDisplay : (isLive ? statusText : statusText);

    return `<div class="score-card${isLive?' card-live':''}${isFinal?' card-final':''}${isUpcoming?' card-upcoming':''}">
      ${headline?`<div class="game-round">${headline}</div>`:''}
      ${teamRow(away)}${teamRow(home)}
      <div class="game-status${isLive?' status-live':''}">${isLive?'🔴 ':''}${displayStatus}</div>
    </div>`;
  }).join('');

  const hasLive = games.some(e => e.competitions?.[0]?.status?.type?.state === 'in');
  const badge = document.getElementById('liveBadge');
  if (badge) badge.style.display = hasLive ? 'flex' : 'none';
}

// ── Render Bracket ────────────────────────────────────────
function renderBracket() {
  ['east','south','west','midwest'].forEach(rk => {
    const region = BRACKET_DATA.regions[rk];
    const ms = region.matchups;

    // R64
    const r1 = document.getElementById(`${rk}-r1`);
    if (r1) r1.innerHTML = `<div class="round-header">First Round</div>` + ms.map(m => matchupCard(m)).join('');

    // Resolve R64 winners to build R32 matchups
    const r2ms = [
      buildAdvancedMatchup(`${rk}-r2-1`, ms[0], ms[1]),
      buildAdvancedMatchup(`${rk}-r2-2`, ms[2], ms[3]),
      buildAdvancedMatchup(`${rk}-r2-3`, ms[4], ms[5]),
      buildAdvancedMatchup(`${rk}-r2-4`, ms[6], ms[7]),
    ];
    const r2 = document.getElementById(`${rk}-r2`);
    if (r2) r2.innerHTML = `<div class="round-header">Second Round</div>` + r2ms.map(m => advancedCard(m)).join('');

    // S16
    const s16ms = [
      buildAdvancedMatchup(`${rk}-s16-1`, r2ms[0], r2ms[1], true),
      buildAdvancedMatchup(`${rk}-s16-2`, r2ms[2], r2ms[3], true),
    ];
    const s16 = document.getElementById(`${rk}-s16`);
    if (s16) s16.innerHTML = `<div class="round-header">Sweet 16</div>` + s16ms.map(m => advancedCard(m)).join('');

    // E8
    const e8m = buildAdvancedMatchup(`${rk}-e8`, s16ms[0], s16ms[1], true);
    const e8 = document.getElementById(`${rk}-e8`);
    if (e8) e8.innerHTML = `<div class="round-header">Elite 8</div>` + advancedCard(e8m, true);

    region._e8matchup = e8m;
  });

  // Final Four slots
  ['east','south','west','midwest'].forEach(rk => {
    const region = BRACKET_DATA.regions[rk];
    const e8m = region._e8matchup;
    const team = e8m ? getMatchupWinner(e8m.id, e8m.t1, e8m.t2) : null;
    const slot = document.getElementById(`ff-${rk}`);
    if (slot) {
      slot.innerHTML = team
        ? `<div class="ff-team-name">${team.name}</div><div class="ff-team-seed">${team.seed ? 'Seed '+team.seed : ''}</div>`
        : `<div class="ff-tbd">TBD</div>`;
      slot.className = 'ff-team-slot' + (team ? ' ff-filled' : '');
    }
  });

  renderFirstFour();
}

function buildAdvancedMatchup(id, src1, src2, isAdvanced = false) {
  // src1/src2 can be a raw matchup (has .r1/.r2) or an advanced matchup (has .t1/.t2/.id)
  let t1, t2;
  if (isAdvanced) {
    t1 = getMatchupWinner(src1.id, src1.t1, src1.t2);
    t2 = getMatchupWinner(src2.id, src2.t1, src2.t2);
  } else {
    t1 = bracketWinners[src1.id] ? { name: bracketWinners[src1.id], seed: src1.r1.seed } : null;
    t2 = bracketWinners[src2.id] ? { name: bracketWinners[src2.id], seed: src2.r1.seed } : null;
    // Fix seed for winner
    if (bracketWinners[src1.id] === src1.r1.name) t1 = { name: src1.r1.name, seed: src1.r1.seed };
    else if (bracketWinners[src1.id] === src1.r2.name) t1 = { name: src1.r2.name, seed: src1.r2.seed };
    if (bracketWinners[src2.id] === src2.r1.name) t2 = { name: src2.r1.name, seed: src2.r1.seed };
    else if (bracketWinners[src2.id] === src2.r2.name) t2 = { name: src2.r2.name, seed: src2.r2.seed };
  }
  return { id, t1, t2 };
}

function getMatchupWinner(id, t1, t2) {
  const winner = bracketWinners[id];
  if (winner) return t1?.name === winner ? t1 : t2?.name === winner ? t2 : { name: winner };
  // Try ESPN direct lookup for advanced rounds
  const t1r = t1 ? findEspnResult(t1.name) : null;
  const t2r = t2 ? findEspnResult(t2.name) : null;
  if (t1r?.winner && t1r?.completed) { bracketWinners[id] = t1.name; return t1; }
  if (t2r?.winner && t2r?.completed) { bracketWinners[id] = t2.name; return t2; }
  return null;
}

function matchupCard(matchup) {
  const t1 = matchup.r1, t2 = matchup.r2;
  const gr = gameResults[matchup.id];
  const t1r = gr?.r1 || null;
  const t2r = gr?.r2 || null;
  const isLive = gr?.isLive || false;
  const done = gr?.completed || false;
  const t1Won = t1r?.winner && done;
  const t2Won = t2r?.winner && done;

  const tl = (team, res, won) => {
    // For First Four placeholder slots, show the actual winner name if known
    let displayName = team.name;
    if (team.firstFour) {
      const ffWinner = bracketWinners[matchup.id + '_ff'];
      displayName = ffWinner ? ffWinner : team.name;
    }
    return `<div class="bk-team${won?' bk-winner':''}${isLive?' bk-live-team':''}${team.firstFour&&!bracketWinners[matchup.id+'_ff']?' bk-tbd':''}">
      <span class="bk-seed">${team.seed}</span>
      <span class="bk-name">${displayName}</span>
      ${res?.score!=null&&(done||isLive)?`<span class="bk-score">${res.score}</span>`:''}
      ${won?'<span class="bk-check">✓</span>':''}
    </div>`;
  };

  return `<div class="bk-matchup${isLive?' bk-live':''}${done?' bk-done':''}">
    ${tl(t1,t1r,t1Won)}<div class="bk-divider"></div>${tl(t2,t2r,t2Won)}
  </div>`;
}

function advancedCard(m, isElite = false) {
  const t1 = m.t1, t2 = m.t2;
  const t1r = t1 ? findEspnResult(t1.name) : null;
  const t2r = t2 ? findEspnResult(t2.name) : null;
  const isLive = t1r?.isLive || t2r?.isLive;
  const done = (t1r?.completed || t2r?.completed) && (!!t1 && !!t2);
  const t1Won = t1r?.winner && done;
  const t2Won = t2r?.winner && done;
  if (t1Won && t1) bracketWinners[m.id] = t1.name;
  else if (t2Won && t2) bracketWinners[m.id] = t2.name;

  const showScores = isLive || t1r?.completed || t2r?.completed;

  const sl = (team, res, won) => {
    if (!team) return `<div class="bk-team bk-tbd"><span class="bk-seed">—</span><span class="bk-name">TBD</span></div>`;
    return `<div class="bk-team${won?' bk-winner':''}${isLive?' bk-live-team':''}">
      ${team.seed?`<span class="bk-seed">${team.seed}</span>`:'<span class="bk-seed">·</span>'}
      <span class="bk-name">${team.name}</span>
      ${res?.score!=null&&showScores?`<span class="bk-score">${res.score}</span>`:''}
      ${won?'<span class="bk-check">✓</span>':''}
    </div>`;
  };

  return `<div class="bk-matchup${isLive?' bk-live':''}${(t1r?.completed||t2r?.completed)?' bk-done':''}${isElite?' bk-elite':''}">
    ${sl(t1,t1r,t1Won)}<div class="bk-divider"></div>${sl(t2,t2r,t2Won)}
  </div>`;
}

function renderFirstFour() {
  const container = document.getElementById('firstFourGames');
  if (!container) return;
  container.innerHTML = BRACKET_DATA.firstFour.map(ff => {
    const n1 = norm(ff.teams[0].split(' (')[0]);
    const n2 = norm(ff.teams[1].split(' (')[0]);
    const r1 = espnResults[n1], r2 = espnResults[n2];
    const isLive = r1?.isLive || r2?.isLive;
    const done = r1?.completed || r2?.completed;
    return `<div class="ff-game-card${isLive?' live':''}${done?' done':''}">
      <div class="ff-game-label">${ff.game}</div>
      <div class="ff-team-line${r1?.winner?' ff-w':''}">
        <span class="ff-team-text">${ff.teams[0]}</span>
        ${r1?.score&&(done||isLive)?`<span class="ff-score">${r1.score}</span>`:''}
      </div>
      <div class="ff-vs-row">vs</div>
      <div class="ff-team-line${r2?.winner?' ff-w':''}">
        <span class="ff-team-text">${ff.teams[1]}</span>
        ${r2?.score&&(done||isLive)?`<span class="ff-score">${r2.score}</span>`:''}
      </div>
      ${isLive?'<div class="ff-live-pill">🔴 LIVE</div>':''}
      ${done&&(r1?.winner||r2?.winner)?`<div class="ff-advances-label">→ ${BRACKET_DATA.regions[ff.region].name} Region</div>`:''}
    </div>`;
  }).join('');
}

function updateLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (!el) return;
  el.textContent = `Updated ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`;
}

// ── Standings & Picks ────────────────────────────────────

function initStandings() {
  renderLeaderboard();
  renderPicksTable();
  renderChampPicks();
}

// Point values per round
const ROUND_PTS = { r64: 1, r32: 2, s16: 4, e8: 8, ff: 16, champion: 32 };
const ROUND_LABELS = { r64: 'R64', r32: 'R32', s16: 'Sweet 16', e8: 'Elite 8', ff: 'Final Four', champion: 'Championship' };
const ROUNDS_ORDER = ['r64', 'r32', 's16', 'e8', 'ff', 'champion'];

function calcScore(member) {
  let pts = 0, correct = 0, maxPts = 0;
  for (const round of ROUNDS_ORDER) {
    const picks = round === 'champion' ? [member.picks.champion] : (member.picks[round] || []);
    const ptVal = ROUND_PTS[round];
    for (const pick of picks) {
      const alive = isTeamAlive(pick);
      const won = hasTeamWonRound(pick, round);
      if (won) { pts += ptVal; correct++; }
      if (alive) maxPts += ptVal;
    }
  }
  return { pts, correct, maxPts };
}

function isTeamAlive(teamName) {
  if (!teamName) return false;
  const n = norm(teamName);
  const result = espnResults[n];
  // If no ESPN data yet (pre-tournament), everyone is alive
  if (!result) return true;
  // Alive = not yet eliminated (no completed loss)
  return !(result.completed && !result.winner);
}

function hasTeamWonRound(teamName, round) {
  if (!teamName) return false;
  const n = norm(teamName);
  const result = espnResults[n];
  if (!result || !result.completed) return false;
  // This is a simplification — a more complete version would track per-round wins
  // For now: winner flag means they won their most recent game
  return result.winner === true;
}

function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  if (!el) return;

  const scored = GROUP_PICKS.map(m => {
    const { pts, correct, maxPts } = calcScore(m);
    return { ...m, pts, correct, maxPts };
  }).sort((a, b) => b.pts - a.pts || b.maxPts - a.maxPts);

  el.innerHTML = scored.map((m, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`;
    const pct = scored[0].maxPts > 0 ? Math.round((m.maxPts / 192) * 100) : 0;
    const ptsPct = m.maxPts > 0 ? Math.round((m.pts / m.maxPts) * 100) : 0;
    return `<div class="lb-row${i===0?' lb-leader':''}">
      <div class="lb-rank">${medal}</div>
      <div class="lb-info">
        <div class="lb-name">${m.name}</div>
        <div class="lb-bracket-name">${m.bracketName || ''}</div>
      </div>
      <div class="lb-stats">
        <div class="lb-pts">${m.pts}<span class="lb-pts-label">pts</span></div>
        <div class="lb-max">max ${m.maxPts}</div>
      </div>
      <div class="lb-bar-wrap">
        <div class="lb-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="lb-champ-pick">🏆 ${m.picks.champion || '—'}</div>
    </div>`;
  }).join('');
}

function renderPicksTable() {
  const thead = document.getElementById('picksHead');
  const tbody = document.getElementById('picksBody');
  if (!thead || !tbody) return;

  // Columns: Round | Team | Member1 | Member2 | ...
  const members = GROUP_PICKS;

  thead.innerHTML = `<tr>
    <th class="pt-round">Round</th>
    <th class="pt-team">Team Picked</th>
    ${members.map(m => `<th class="pt-member">${m.name}</th>`).join('')}
  </tr>`;

  // Build rows: for each round, list all unique picks across all members
  // Labels describe what the teams ARE at that stage, not which round they won
  const TABLE_LABELS = {
    s16: 'Elite 8',
    e8: 'Final Four',       // teams that won their Elite 8 game → are in Final Four
    ff: 'Championship',     // teams that won their Final Four game → are in Championship
    champion: 'Champion',
  };

  let rows = '';
  const roundsToShow = ['s16','e8','ff','champion'];

  for (const round of roundsToShow) {
    const label = TABLE_LABELS[round];
    const allPicks = new Set();
    members.forEach(m => {
      const picks = round === 'champion' ? [m.picks.champion] : (m.picks[round] || []);
      picks.forEach(p => p && allPicks.add(p));
    });

    const pickList = [...allPicks].sort();
    let first = true;
    for (const team of pickList) {
      const alive = isTeamAlive(team);
      const eliminated = !alive;
      rows += `<tr class="${eliminated ? 'pick-elim' : 'pick-alive'}">
        ${first ? `<td class="pt-round-label" rowspan="${pickList.length}">${label}</td>` : ''}
        <td class="pt-team-name${eliminated?' elim':' alive'}">${team}${eliminated ? ' ✗' : alive ? ' ✓' : ''}</td>
        ${members.map(m => {
          const mPicks = round === 'champion' ? [m.picks.champion] : (m.picks[round] || []);
          const picked = mPicks.includes(team);
          return `<td class="pt-cell${picked ? (eliminated?' pt-bad':' pt-good') : ' pt-empty'}">${picked ? (eliminated?'✗':'✓') : '·'}</td>`;
        }).join('')}
      </tr>`;
      first = false;
    }
  }

  tbody.innerHTML = rows || `<tr><td colspan="10" class="pt-empty-msg">Picks will populate here once brackets are entered</td></tr>`;
}

function renderChampPicks() {
  const el = document.getElementById('champPicksGrid');
  if (!el) return;
  el.innerHTML = GROUP_PICKS.map(m => {
    const champ = m.picks.champion;
    const alive = isTeamAlive(champ);
    return `<div class="champ-pick-card${!alive?' champ-dead':''}">
      <div class="champ-pick-name">${m.name}</div>
      <div class="champ-pick-team">${champ || '—'}</div>
      ${!alive ? '<div class="champ-pick-status">Eliminated ✗</div>' : '<div class="champ-pick-status alive">Still Alive ✓</div>'}
    </div>`;
  }).join('');
}

// Stub for old references
function loadStandings() { initStandings(); }
function saveStandings() {}
function addParticipant() {}
function removeParticipant() {}
function renderStandingsList() {}
function renderStandingsEditor() {}
function showSaveFlash() {}
