// app/api/scores/route.ts
//
// Syncs ESPN tournament scores into Supabase tournament_games.
//
// Two entry points:
//   GET  /api/scores           → fetches ESPN server-side (may fail on Vercel due to IP blocks)
//   POST /api/scores           → accepts ESPN events from client-side fetch (preferred)
//
// Both use the same safe processing pipeline:
//   1. Match each ESPN event to a tournament_games row by name (no home/away guessing)
//   2. Validate scores are consistent with winner before writing
//   3. Skip writes for ambiguous or failed name matches (protect existing data)
//   4. Propagate winners → next round team slots
//   5. Post-update validation of all completed games
//   6. Return warnings array so UI can surface problems

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  TOURNAMENT_DATES,
  R64_GAME_MAP,
  nameMatches,
  normalizeName,
  fetchESPNDays,
  getTVFromEvent,
  getVenueFromEvent,
  getGameTimeFromEvent,
  getStatusFromEvent,
  getScoresFromEvent,
  type ESPNEvent,
} from '@/lib/espn'

// ─── Full propagation map: any game → the next round slot it feeds into ──────
const NEXT_GAME_MAP: Record<string, { nextGameId: string; teamSlot: 1 | 2 }> = {
  // R64 → R32
  S1:{nextGameId:'SR1G0',teamSlot:1}, S2:{nextGameId:'SR1G0',teamSlot:2},
  S3:{nextGameId:'SR1G1',teamSlot:1}, S4:{nextGameId:'SR1G1',teamSlot:2},
  S5:{nextGameId:'SR1G2',teamSlot:1}, S6:{nextGameId:'SR1G2',teamSlot:2},
  S7:{nextGameId:'SR1G3',teamSlot:1}, S8:{nextGameId:'SR1G3',teamSlot:2},
  E1:{nextGameId:'ER1G0',teamSlot:1}, E2:{nextGameId:'ER1G0',teamSlot:2},
  E3:{nextGameId:'ER1G1',teamSlot:1}, E4:{nextGameId:'ER1G1',teamSlot:2},
  E5:{nextGameId:'ER1G2',teamSlot:1}, E6:{nextGameId:'ER1G2',teamSlot:2},
  E7:{nextGameId:'ER1G3',teamSlot:1}, E8:{nextGameId:'ER1G3',teamSlot:2},
  W1:{nextGameId:'WR1G0',teamSlot:1}, W2:{nextGameId:'WR1G0',teamSlot:2},
  W3:{nextGameId:'WR1G1',teamSlot:1}, W4:{nextGameId:'WR1G1',teamSlot:2},
  W5:{nextGameId:'WR1G2',teamSlot:1}, W6:{nextGameId:'WR1G2',teamSlot:2},
  W7:{nextGameId:'WR1G3',teamSlot:1}, W8:{nextGameId:'WR1G3',teamSlot:2},
  M1:{nextGameId:'MR1G0',teamSlot:1}, M2:{nextGameId:'MR1G0',teamSlot:2},
  M3:{nextGameId:'MR1G1',teamSlot:1}, M4:{nextGameId:'MR1G1',teamSlot:2},
  M5:{nextGameId:'MR1G2',teamSlot:1}, M6:{nextGameId:'MR1G2',teamSlot:2},
  M7:{nextGameId:'MR1G3',teamSlot:1}, M8:{nextGameId:'MR1G3',teamSlot:2},
  // R32 → S16
  SR1G0:{nextGameId:'SR2G0',teamSlot:1}, SR1G1:{nextGameId:'SR2G0',teamSlot:2},
  SR1G2:{nextGameId:'SR2G1',teamSlot:1}, SR1G3:{nextGameId:'SR2G1',teamSlot:2},
  ER1G0:{nextGameId:'ER2G0',teamSlot:1}, ER1G1:{nextGameId:'ER2G0',teamSlot:2},
  ER1G2:{nextGameId:'ER2G1',teamSlot:1}, ER1G3:{nextGameId:'ER2G1',teamSlot:2},
  WR1G0:{nextGameId:'WR2G0',teamSlot:1}, WR1G1:{nextGameId:'WR2G0',teamSlot:2},
  WR1G2:{nextGameId:'WR2G1',teamSlot:1}, WR1G3:{nextGameId:'WR2G1',teamSlot:2},
  MR1G0:{nextGameId:'MR2G0',teamSlot:1}, MR1G1:{nextGameId:'MR2G0',teamSlot:2},
  MR1G2:{nextGameId:'MR2G1',teamSlot:1}, MR1G3:{nextGameId:'MR2G1',teamSlot:2},
  // S16 → E8
  SR2G0:{nextGameId:'SR3G0',teamSlot:1}, SR2G1:{nextGameId:'SR3G0',teamSlot:2},
  ER2G0:{nextGameId:'ER3G0',teamSlot:1}, ER2G1:{nextGameId:'ER3G0',teamSlot:2},
  WR2G0:{nextGameId:'WR3G0',teamSlot:1}, WR2G1:{nextGameId:'WR3G0',teamSlot:2},
  MR2G0:{nextGameId:'MR3G0',teamSlot:1}, MR2G1:{nextGameId:'MR3G0',teamSlot:2},
  // E8 → FF
  SR3G0:{nextGameId:'FF1',teamSlot:1}, ER3G0:{nextGameId:'FF1',teamSlot:2},
  WR3G0:{nextGameId:'FF2',teamSlot:1}, MR3G0:{nextGameId:'FF2',teamSlot:2},
  // FF → CHAMP
  FF1:{nextGameId:'CHAMP',teamSlot:1}, FF2:{nextGameId:'CHAMP',teamSlot:2},
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toESPNDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function getDatesToFetch(url: URL): string[] {
  const date = url.searchParams.get('date')
  if (date) return [date]
  if (url.searchParams.get('all') === '1') return TOURNAMENT_DATES
  const today = new Date()
  return [
    toESPNDate(new Date(today.getTime() - 86_400_000)),
    toESPNDate(today),
    toESPNDate(new Date(today.getTime() + 86_400_000)),
  ]
}

// ─── DB row type ──────────────────────────────────────────────────────────────

interface DBGame {
  game_id: string
  round: number
  region: string | null
  team1: string | null
  team2: string | null
  winner: number | null
  winner_name: string | null
  status: string | null
  espn_event_id: string | null
}

// ─── Match ESPN event → our game_id ──────────────────────────────────────────

function matchEventToGameId(
  event: ESPNEvent,
  dbGames: DBGame[],
  eventIdIndex: Map<string, string>
): string | null {
  // 1. Direct espn_event_id lookup
  if (eventIdIndex.has(event.id)) return eventIdIndex.get(event.id)!

  const comp = event.competitions?.[0]
  if (!comp) return null

  const competitors = comp.competitors
  const knownTeams = competitors.filter((c: any) => c.team.id !== '-2')
  if (knownTeams.length === 0) return null

  // 2. R64: match by team names from static map
  for (const [gameId, [t1Terms, t2Terms]] of Object.entries(R64_GAME_MAP)) {
    const locs = competitors.map((c: any) => c.team.location)
    const names = competitors.map((c: any) => c.team.displayName)
    const hasT1 = locs.some((l: string) => nameMatches(l, t1Terms)) || names.some((n: string) => nameMatches(n, t1Terms))
    const hasTBD = competitors.some((c: any) => c.team.id === '-2')
    const hasT2 = hasTBD || locs.some((l: string) => nameMatches(l, t2Terms)) || names.some((n: string) => nameMatches(n, t2Terms))
    if (hasT1 && hasT2) return gameId
  }

  // 3. R32+: match by team names in tournament_games DB (normalized)
  for (const dbGame of dbGames) {
    if (dbGame.round === 0) continue
    if (!dbGame.team1 || !dbGame.team2) continue
    if (dbGame.status === 'final') continue

    const t1 = normalizeName(dbGame.team1)
    const t2 = normalizeName(dbGame.team2)
    const locs = competitors.map((c: any) => normalizeName(c.team.location))
    const dnames = competitors.map((c: any) => normalizeName(c.team.displayName))
    const matchT1 = locs.some((l: string) => l.includes(t1) || t1.includes(l)) ||
                    dnames.some((n: string) => n.includes(t1) || t1.includes(n))
    const matchT2 = locs.some((l: string) => l.includes(t2) || t2.includes(l)) ||
                    dnames.some((n: string) => n.includes(t2) || t2.includes(n))
    if (matchT1 && matchT2) return dbGame.game_id
  }

  return null
}

// ─── Shared processing pipeline ───────────────────────────────────────────────
// Used by both GET and POST handlers

async function processESPNEvents(events: ESPNEvent[]) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check manual-mode flag
  const { data: modeSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'results_mode')
    .single()

  if (modeSetting?.value === 'manual') {
    return { mode: 'manual', message: 'ESPN sync disabled — using manual mode.' }
  }

  // Load all tournament_games from DB
  const { data: dbGames, error: dbError } = await supabase
    .from('tournament_games')
    .select('game_id, round, region, team1, team2, winner, winner_name, status, espn_event_id')

  if (dbError || !dbGames) {
    return { error: 'Could not load tournament games from DB', detail: dbError?.message ?? 'unknown' }
  }

  // Build espn_event_id → game_id index
  const eventIdIndex = new Map<string, string>()
  for (const g of dbGames) {
    if (g.espn_event_id) eventIdIndex.set(g.espn_event_id, g.game_id)
  }

  // ── Match events and build update payloads ──────────────────────────────

  type GameUpdate = {
    game_id: string
    espn_event_id: string
    status: string
    tv: string
    venue: string
    game_time: string
    score1: number | null
    score2: number | null
    winner: number | null
    winner_name: string | null
  }

  const updates: GameUpdate[] = []
  const matchLog: string[] = []
  const warnings: string[] = []
  const skipped: string[] = []

  for (const event of events) {
    const gameId = matchEventToGameId(event, dbGames, eventIdIndex)
    if (!gameId) continue

    eventIdIndex.set(event.id, gameId)

    const dbGame = dbGames.find(g => g.game_id === gameId)
    const status = getStatusFromEvent(event)

    // ── Early exit for completed games ────────────────────────────────────
    // ESPN recycles event IDs across rounds — e.g. the E1 event (Duke vs Siena)
    // becomes the S16 event (Duke vs UConn) after R64 ends. Attempting to match
    // R64 team names against the recycled event produces false warnings.
    // Since the game is already resolved, just update metadata and move on.
    if (dbGame?.winner_name) {
      const { error } = await supabase
        .from('tournament_games')
        .update({
          espn_event_id: event.id,
          tv: getTVFromEvent(event),
          venue: getVenueFromEvent(event),
          game_time: getGameTimeFromEvent(event),
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', gameId)
      if (error) console.error(`Metadata update failed for ${gameId}:`, error)
      matchLog.push(`${gameId}: already completed (${dbGame.winner_name}) — metadata only, skipped score extraction`)
      continue
    }

    const scoreResult = getScoresFromEvent(event, gameId, dbGame?.team1, dbGame?.team2)

    if (scoreResult.warning) {
      warnings.push(scoreResult.warning)
    }

    // CRITICAL: If game is final but we got no winner, SKIP the score write
    if (status === 'final' && scoreResult.winner === null) {
      skipped.push(`${gameId}: final but no winner — skipping DB write to protect existing data`)
      const { error } = await supabase
        .from('tournament_games')
        .update({
          espn_event_id: event.id,
          tv: getTVFromEvent(event),
          venue: getVenueFromEvent(event),
          game_time: getGameTimeFromEvent(event),
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', gameId)
      if (error) console.error(`Metadata update failed for ${gameId}:`, error)
      continue
    }

    updates.push({
      game_id: gameId,
      espn_event_id: event.id,
      status,
      tv: getTVFromEvent(event),
      venue: getVenueFromEvent(event),
      game_time: getGameTimeFromEvent(event),
      score1: scoreResult.score1,
      score2: scoreResult.score2,
      winner: scoreResult.winner,
      winner_name: scoreResult.winnerName,
    })

    matchLog.push(`${gameId} → ESPN ${event.id} (${event.name}) [${status}]`)
  }

  // ── Write updates to Supabase ───────────────────────────────────────────
  // Guard: if a game already has a winner in the DB, don't overwrite it.
  // This protects manual SQL fixes from being clobbered by re-fetches.
  // New game results (winner=null in DB) flow through normally.

  // Guard: check which games already have winner_name set in DB
  const dbWinnerNameMap = new Map<string, string | null>()
  for (const g of dbGames) {
    dbWinnerNameMap.set(g.game_id, (g as any).winner_name ?? null)
  }

  let updatedCount = 0
  let errorCount = 0
  const updateErrors: string[] = []

  for (const u of updates) {
    const existingWinnerName = dbWinnerNameMap.get(u.game_id)

    const payload: Record<string, unknown> = {
      espn_event_id: u.espn_event_id,
      tv: u.tv,
      venue: u.venue,
      game_time: u.game_time,
      updated_at: new Date().toISOString(),
    }

    if (existingWinnerName) {
      // DB already has a winner_name — protect it, only update metadata
      matchLog.push(`${u.game_id}: winner_name already set (${existingWinnerName}) — metadata only`)
    } else {
      // No winner yet — write scores, status, winner, and winner_name
      payload.status = u.status
      payload.score1 = u.score1
      payload.score2 = u.score2
      if (u.winner !== null) payload.winner = u.winner
      if (u.winner_name) payload.winner_name = u.winner_name
    }

    const { error } = await supabase
      .from('tournament_games')
      .update(payload)
      .eq('game_id', u.game_id)

    if (error) {
      errorCount++
      updateErrors.push(`${u.game_id}: ${error.message}`)
      console.error(`Update failed for ${u.game_id}:`, error)
    } else {
      updatedCount++
    }
  }

  // ── Propagate ALL completed game winners → next round team slots ────────
  //    Uses winner_name (the canonical team name) — no more 1/2 slot math

  const { data: completedGames } = await supabase
    .from('tournament_games')
    .select('game_id, winner_name')
    .not('winner_name', 'is', null)

  let propagated = 0

  for (const game of completedGames ?? []) {
    if (!game.winner_name) continue

    const next = NEXT_GAME_MAP[game.game_id]
    if (!next) continue

    const field = next.teamSlot === 1 ? 'team1' : 'team2'

    const { error } = await supabase
      .from('tournament_games')
      .update({ [field]: game.winner_name })
      .eq('game_id', next.nextGameId)
      .is(field, null)

    if (!error) propagated++
  }

  // ── Post-update validation ──────────────────────────────────────────────

  const { data: allCompleted } = await supabase
    .from('tournament_games')
    .select('game_id, team1, team2, score1, score2, winner')
    .not('winner', 'is', null)

  const inconsistencies: string[] = []
  for (const g of allCompleted ?? []) {
    if (g.score1 == null || g.score2 == null) continue
    if (g.winner === 1 && g.score1 < g.score2) {
      inconsistencies.push(
        `${g.game_id}: ${g.team1} marked winner but scored ${g.score1} vs ${g.team2} ${g.score2}`
      )
    } else if (g.winner === 2 && g.score2 < g.score1) {
      inconsistencies.push(
        `${g.game_id}: ${g.team2} marked winner but scored ${g.score2} vs ${g.team1} ${g.score1}`
      )
    }
  }

  if (inconsistencies.length > 0) {
    warnings.push(...inconsistencies.map(i => `⚠ DB INCONSISTENCY: ${i}`))
  }

  return {
    success: true,
    espnEventsFound: events.length,
    gamesMatched: updates.length,
    gamesUpdated: updatedCount,
    errors: errorCount,
    propagated,
    matches: matchLog,
    warnings: warnings.length > 0 ? warnings : undefined,
    skipped: skipped.length > 0 ? skipped : undefined,
    updateErrors: updateErrors.length > 0 ? updateErrors : undefined,
    completedGames: (allCompleted ?? []).length,
    hasInconsistencies: inconsistencies.length > 0,
  }
}

// ─── GET handler (server-side ESPN fetch — may fail on Vercel) ────────────────

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const dates = getDatesToFetch(url)
    const events = await fetchESPNDays(dates)
    const result = await processESPNEvents(events)

    if ('error' in result) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json({ ...result, datesChecked: dates, source: 'server' })
  } catch (err) {
    console.error('ESPN sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── POST handler (client-side ESPN fetch — preferred) ────────────────────────
//
// The client fetches ESPN from the browser (bypasses Vercel IP blocks),
// then sends the raw event data here for safe matching and DB writes.
//
// Expected body: { events: ESPNEvent[] }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const events: ESPNEvent[] = body.events ?? []

    if (events.length === 0) {
      return NextResponse.json({ error: 'No ESPN events provided' }, { status: 400 })
    }

    const result = await processESPNEvents(events)

    if ('error' in result) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json({ ...result, source: 'client' })
  } catch (err) {
    console.error('ESPN sync (POST) error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
