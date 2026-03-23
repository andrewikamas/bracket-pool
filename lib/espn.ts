// lib/espn.ts
// ESPN undocumented API helpers for NCAA Tournament score syncing

export const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'

// All tournament dates — used by ?all=1 to seed everything at once
export const TOURNAMENT_DATES = [
  '20260317', '20260318', // First Four (Tue/Wed)
  '20260319', '20260320', // Round of 64 (Thu/Fri)
  '20260321', '20260322', // Round of 32 (Sat/Sun)
  '20260326', '20260327', // Sweet 16 (Thu/Fri)
  '20260328', '20260329', // Elite 8 (Sat/Sun)
  '20260404',             // Final Four (Sat)
  '20260406',             // Championship (Mon)
]

// ─── ESPN response types ─────────────────────────────────────────────────────

export interface ESPNTeam {
  id: string
  location: string        // e.g. "Ohio State"
  name: string            // e.g. "Buckeyes"
  abbreviation: string    // e.g. "OSU"
  displayName: string     // e.g. "Ohio State Buckeyes"
}

export interface ESPNCompetitor {
  order: number
  homeAway: 'home' | 'away'
  team: ESPNTeam
  score: string           // "0" before game, "74" after
  curatedRank: { current: number }  // seed number
}

export interface ESPNEvent {
  id: string
  name: string
  date: string
  startDate: string
  broadcast: string       // top-level shorthand
  tournamentId?: number   // 22 = NCAA Men's Tournament
  status: {
    clock: number
    displayClock: string
    period: number
    type: {
      id: string
      name: string
      state: 'pre' | 'in' | 'post'
      completed: boolean
      description: string
      detail: string        // "Thu, March 19th at 12:15 PM EDT"
      shortDetail: string   // "3/19 - 12:15 PM EDT"
    }
  }
  competitions: Array<{
    venue: {
      id: string
      fullName: string
      address: { city: string; state: string }
    }
    competitors: ESPNCompetitor[]
    broadcasts: Array<{ market: string; names: string[] }>
    notes: Array<{ type: string; headline: string }>
  }>
  geoBroadcasts: Array<{
    type: { shortName: string }
    media: { shortName: string }
  }>
}

// ─── R64 team name map ───────────────────────────────────────────────────────
// Maps our game_id → [team1 search terms, team2 search terms]
// Search terms are matched against ESPN's team.location or team.displayName
// (case-insensitive partial match)
//
// team1 = higher seed (the "favored" team in the matchup)
// team2 = lower seed
//
// For First Four play-in teams (M1, W5) team2 is TBD until Wed Mar 18;
// those are handled specially below.

export const R64_GAME_MAP: Record<string, [string[], string[]]> = {
  // ── South ──────────────────────────────────────────────────────────────────
  'S1': [['Florida'],          ['Prairie View', 'PV A&M', 'Lehigh']],
  'S2': [['Clemson'],          ['Iowa']],
  'S3': [['Vanderbilt'],       ['McNeese']],
  'S4': [['Nebraska'],         ['Troy']],
  'S5': [['North Carolina'],   ['VCU']],
  'S6': [['Illinois'],         ['Pennsylvania', 'Penn']],
  'S7': [["Saint Mary's", "St. Mary's"], ['Texas A&M']],
  'S8': [['Houston'],          ['Idaho']],
  // ── East ───────────────────────────────────────────────────────────────────
  'E1': [['Duke'],             ['Siena']],
  'E2': [['Ohio State'],       ['TCU']],
  'E3': [["St. John's", "Saint John's"], ['Northern Iowa']],
  'E4': [['Kansas'],           ['California Baptist', 'Cal Baptist']],
  'E5': [['Louisville'],       ['South Florida']],
  'E6': [['Michigan State'],   ['North Dakota State', 'N. Dakota St']],
  'E7': [['UCLA'],             ['UCF', 'Central Florida']],
  'E8': [['UConn', 'Connecticut'], ['Furman']],
  // ── West ───────────────────────────────────────────────────────────────────
  'W1': [['Arizona'],          ['LIU', 'Long Island']],
  'W2': [['Villanova'],        ['Utah State', 'Utah St']],
  'W3': [['Wisconsin'],        ['High Point']],
  'W4': [['Arkansas'],         ["Hawai'i", 'Hawaii']],
  'W5': [['BYU'],              ['Texas', 'NC State', 'North Carolina State']],
  'W6': [['Gonzaga'],          ['Kennesaw State', 'Kennesaw St']],
  'W7': [['Miami'],            ['Missouri']],
  'W8': [['Purdue'],           ['Queens']],
  // ── Midwest ────────────────────────────────────────────────────────────────
  'M1': [['Michigan'],         ['UMBC', 'Maryland-Baltimore', 'Howard']],
  'M2': [['Georgia'],          ['Saint Louis']],
  'M3': [['Texas Tech'],       ['Akron']],
  'M4': [['Alabama'],          ['Hofstra']],
  'M5': [['Tennessee'],        ['SMU', 'Miami (OH)', 'Miami (Ohio)']],
  'M6': [['Virginia'],         ['Wright State', 'Wright St']],
  'M7': [['Kentucky'],         ['Santa Clara']],
  'M8': [['Iowa State', 'Iowa St'], ['Tennessee State', 'Tennessee St']],
}

// ─── Helper functions ────────────────────────────────────────────────────────

/**
 * Normalize a team name for matching.
 * Handles: "Utah St." → "utah state", "N. Dakota St." → "north dakota state",
 *          "Miami (FL)" → "miami", "St. John's" stays "st john's"
 */
export function normalizeName(name: string): string {
  let n = name.toLowerCase().trim()
  // Remove parenthetical qualifiers: "(FL)", "(OH)", etc.
  n = n.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  // Expand "St." / "St" at END of string to "state"
  // (but NOT "St." at start, which means "Saint" as in "St. John's")
  n = n.replace(/\bst\.?\s*$/i, 'state')
  // Expand "N." at start to "north"
  n = n.replace(/^n\.\s*/i, 'north ')
  // Remove remaining periods
  n = n.replace(/\./g, '')
  // Normalize whitespace
  n = n.replace(/\s+/g, ' ').trim()
  return n
}

/**
 * Case-insensitive name match with normalization.
 * Checks both raw partial-include AND normalized partial-include.
 * This handles "Utah St." matching "Utah State", "Miami (FL)" matching "Miami", etc.
 */
export function nameMatches(espnName: string, searchTerms: string[]): boolean {
  const rawLower = espnName.toLowerCase()
  const normEspn = normalizeName(espnName)

  return searchTerms.some(t => {
    const rawTerm = t.toLowerCase()
    const normTerm = normalizeName(t)

    // Raw partial match (original behavior — still useful for exact/substring matches)
    if (rawLower.includes(rawTerm) || rawTerm.includes(rawLower)) return true

    // Normalized partial match (catches "Utah St." vs "Utah State")
    if (normEspn.includes(normTerm) || normTerm.includes(normEspn)) return true

    return false
  })
}

/** Fetch ESPN scoreboard for one date string (YYYYMMDD), filtered to NCAA tourney. */
export async function fetchESPNDay(dateStr: string): Promise<ESPNEvent[]> {
  try {
    const url = `${ESPN_SCOREBOARD}?dates=${dateStr}&groups=100&limit=50`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.espn.com/',
      },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data.events ?? []) as ESPNEvent[]).filter(e => e.tournamentId === 22)
  } catch {
    return []
  }
}

/** Fetch multiple ESPN days in parallel, deduplicated by event id. */
export async function fetchESPNDays(dates: string[]): Promise<ESPNEvent[]> {
  const arrays = await Promise.all(dates.map(fetchESPNDay))
  const seen = new Set<string>()
  const results: ESPNEvent[] = []
  for (const arr of arrays) {
    for (const e of arr) {
      if (!seen.has(e.id)) { seen.add(e.id); results.push(e) }
    }
  }
  return results
}

/** Extract TV channel from an ESPN event. */
export function getTVFromEvent(event: ESPNEvent): string {
  return event.geoBroadcasts?.[0]?.media?.shortName
    ?? event.competitions?.[0]?.broadcasts?.[0]?.names?.[0]
    ?? event.broadcast
    ?? 'TBD'
}

/** Extract "Venue Name, City, ST" from an ESPN event. */
export function getVenueFromEvent(event: ESPNEvent): string {
  const v = event.competitions?.[0]?.venue
  if (!v) return 'TBD'
  return `${v.fullName}, ${v.address.city}, ${v.address.state}`
}

/** Extract human-readable game time from ESPN's detail string.
 *  e.g. "Thu, March 19th at 12:15 PM EDT" → "12:15 PM EDT" */
export function getGameTimeFromEvent(event: ESPNEvent): string {
  const detail = event.status?.type?.detail ?? ''
  const match = detail.match(/at (.+)$/)
  return match ? match[1] : 'TBD'
}

/** Map ESPN status state to our DB status values. */
export function getStatusFromEvent(event: ESPNEvent): 'scheduled' | 'live' | 'final' {
  const state = event.status?.type?.state
  if (state === 'post') return 'final'
  if (state === 'in') return 'live'
  return 'scheduled'
}

export interface ScoreResult {
  score1: number | null
  score2: number | null
  winner: 1 | 2 | null       // kept for backwards compat, but scoring should use winnerName
  winnerName: string | null   // THE SOURCE OF TRUTH — canonical team name that won
  warning?: string
}

/**
 * Extract scores and winner from an ESPN event.
 *
 * APPROACH: Match each ESPN competitor to our team1/team2 BY NAME,
 * not by home/away designation (which is arbitrary in tournament games).
 *
 * For R64 games: team1/team2 search terms come from R64_GAME_MAP.
 * For R32+ games: team1/team2 names come from tournament_games DB rows.
 *
 * Returns null scores + warning if name matching fails, rather than
 * guessing and potentially writing wrong data.
 */
export function getScoresFromEvent(
  event: ESPNEvent,
  gameId: string,
  dbTeam1?: string | null,
  dbTeam2?: string | null
): ScoreResult & { warning?: string } {
  const comp = event.competitions?.[0]
  if (!comp) return { score1: null, score2: null, winner: null, winnerName: null, warning: 'No competition data' }

  const competitors = comp.competitors
  if (competitors.length < 2) return { score1: null, score2: null, winner: null, winnerName: null, warning: 'Fewer than 2 competitors' }

  const completed = event.status?.type?.completed ?? false

  // ── Build name-matching terms for team1 and team2 ────────────────────────
  let t1Terms: string[] = []
  let t2Terms: string[] = []

  const r64 = R64_GAME_MAP[gameId]
  if (r64) {
    // R64: use our curated static map (most reliable)
    t1Terms = r64[0]
    t2Terms = r64[1]
  } else if (dbTeam1 && dbTeam2) {
    // R32+: use the team names from tournament_games
    t1Terms = [dbTeam1]
    t2Terms = [dbTeam2]
  } else {
    return { score1: null, score2: null, winner: null, winnerName: null, warning: `${gameId}: No team names available for matching` }
  }

  // ── Match each ESPN competitor to team1 or team2 by name ─────────────────
  // Check BOTH location and displayName for each competitor
  let team1Competitor: ESPNCompetitor | null = null
  let team2Competitor: ESPNCompetitor | null = null

  for (const c of competitors) {
    const loc = c.team.location
    const dn = c.team.displayName

    const matchesT1 = nameMatches(loc, t1Terms) || nameMatches(dn, t1Terms)
    const matchesT2 = nameMatches(loc, t2Terms) || nameMatches(dn, t2Terms)

    if (matchesT1 && !matchesT2) {
      team1Competitor = c
    } else if (matchesT2 && !matchesT1) {
      team2Competitor = c
    } else if (matchesT1 && matchesT2) {
      // Ambiguous match — both terms match the same competitor
      // This can happen with fuzzy names like "Miami" matching both teams
      return {
        score1: null, score2: null, winner: null, winnerName: null,
        warning: `${gameId}: Ambiguous name match — "${loc}" matches both team1 and team2 terms`
      }
    }
  }

  // ── Validate we found both competitors ───────────────────────────────────
  if (!team1Competitor || !team2Competitor) {
    const espnNames = competitors.map(c => c.team.location).join(', ')
    const missing = !team1Competitor ? `team1 (${t1Terms.join('/')})` : `team2 (${t2Terms.join('/')})`
    return {
      score1: null, score2: null, winner: null, winnerName: null,
      warning: `${gameId}: Could not match ${missing} in ESPN competitors [${espnNames}]`
    }
  }

  // ── Extract scores from the CORRECT competitors ──────────────────────────
  const score1 = parseInt(team1Competitor.score || '0') || 0
  const score2 = parseInt(team2Competitor.score || '0') || 0

  // ── Determine winner ─────────────────────────────────────────────────────
  let winner: 1 | 2 | null = null
  if (completed && score1 !== score2) {
    winner = score1 > score2 ? 1 : 2
  }

  // ── Final validation: scores must be consistent with winner ───────────────
  let warning: string | undefined
  if (completed && score1 === score2) {
    warning = `${gameId}: Game marked complete but scores are tied (${score1}-${score2})`
  }
  if (winner === 1 && score1 <= score2) {
    warning = `${gameId}: CRITICAL — winner=1 but score1(${score1}) <= score2(${score2})`
  }
  if (winner === 2 && score2 <= score1) {
    warning = `${gameId}: CRITICAL — winner=2 but score2(${score2}) <= score1(${score1})`
  }

  // ── Resolve winner's canonical name ─────────────────────────────────────
  // dbTeam1/dbTeam2 are our canonical names from REGIONS/propagation
  const winnerName = winner === 1 ? (dbTeam1 ?? null) : winner === 2 ? (dbTeam2 ?? null) : null

  return {
    score1: score1 > 0 || completed ? score1 : null,
    score2: score2 > 0 || completed ? score2 : null,
    winner,
    winnerName,
    warning,
  }
}

/**
 * Given a completed R64 game and its winner (1 or 2),
 * returns the next round game_id and whether the winner goes to slot 1 or 2.
 *
 * R64 game IDs: "S1"–"S8" (1-indexed)
 * R32 game IDs: "SR1G0"–"SR1G3"
 */
export function getNextRoundSlot(
  gameId: string,
  winner: 1 | 2
): { nextGameId: string; teamSlot: 1 | 2 } | null {
  // Only handle R64 → R32 propagation here
  const region = gameId[0]
  const slotOneBased = parseInt(gameId.slice(1))
  if (isNaN(slotOneBased) || slotOneBased < 1 || slotOneBased > 8) return null

  const slotZero = slotOneBased - 1              // 0-indexed
  const r32Slot = Math.floor(slotZero / 2)       // 0, 1, 2, or 3
  const teamSlot: 1 | 2 = slotZero % 2 === 0 ? 1 : 2  // even → team1, odd → team2

  return { nextGameId: `${region}R1G${r32Slot}`, teamSlot }
}
