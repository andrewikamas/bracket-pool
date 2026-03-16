// app/api/scores/route.ts
//
// Fetches ESPN tournament scores and syncs them into Supabase tournament_games.
//
// Usage:
//   GET /api/scores          → sync today ± 1 day (fast, use on leaderboard load)
//   GET /api/scores?all=1    → sync all tournament dates (use once to seed)
//   GET /api/scores?date=20260319  → sync a specific date
//
// What it does:
//   1. Fetches ESPN scoreboard for the requested dates
//   2. Matches each event to a tournament_games row (by espn_event_id or team name)
//   3. Updates: espn_event_id, tv, venue, game_time, status, score1, score2, winner
//   4. Propagates R64 winners → R32 team slots so later rounds can be matched
//
// ⚠️  Run this SQL in Supabase before deploying (adds columns if missing):
//
//   alter table tournament_games
//     add column if not exists espn_event_id text,
//     add column if not exists tv            text,
//     add column if not exists game_time     text,
//     add column if not exists score1        int,
//     add column if not exists score2        int,
//     add column if not exists updated_at    timestamptz default now();
//
//   -- venue column should already exist from migration, but just in case:
//   alter table tournament_games
//     add column if not exists venue text;

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  TOURNAMENT_DATES,
  R64_GAME_MAP,
  nameMatches,
  fetchESPNDays,
  getTVFromEvent,
  getVenueFromEvent,
  getGameTimeFromEvent,
  getStatusFromEvent,
  getScoresFromEvent,
  getNextRoundSlot,
  type ESPNEvent,
} from '@/lib/espn'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toESPNDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function getDatesToFetch(url: URL): string[] {
  // Explicit date param
  const date = url.searchParams.get('date')
  if (date) return [date]

  // All tournament dates
  if (url.searchParams.get('all') === '1') return TOURNAMENT_DATES

  // Default: yesterday, today, tomorrow (catches live + recently finished games)
  const today = new Date()
  return [
    toESPNDate(new Date(today.getTime() - 86_400_000)),
    toESPNDate(today),
    toESPNDate(new Date(today.getTime() + 86_400_000)),
  ]
}

// ─── DB row type (only the fields we need) ────────────────────────────────────

interface DBGame {
  game_id: string
  round: number
  region: string | null
  team1: string | null
  team2: string | null
  winner: number | null
  status: string | null
  espn_event_id: string | null
}

// ─── Match ESPN event → our game_id ──────────────────────────────────────────

function matchEventToGameId(
  event: ESPNEvent,
  dbGames: DBGame[],
  eventIdIndex: Map<string, string>   // espn_event_id → game_id
): string | null {
  // 1. Direct espn_event_id lookup (fastest, works for all rounds once seeded)
  if (eventIdIndex.has(event.id)) return eventIdIndex.get(event.id)!

  const comp = event.competitions?.[0]
  if (!comp) return null

  const competitors = comp.competitors
  // Ignore events where both teams are TBD
  const knownTeams = competitors.filter(c => c.team.id !== '-2')
  if (knownTeams.length === 0) return null

  // 2. R64: match by team names from our static map
  for (const [gameId, [t1Terms, t2Terms]] of Object.entries(R64_GAME_MAP)) {
    const locs = competitors.map(c => c.team.location)
    const names = competitors.map(c => c.team.displayName)

    const hasT1 = locs.some(l => nameMatches(l, t1Terms)) || names.some(n => nameMatches(n, t1Terms))

    // TBD opponent: only require team1 match (First Four play-in games)
    const hasTBD = competitors.some(c => c.team.id === '-2')
    const hasT2 = hasTBD || locs.some(l => nameMatches(l, t2Terms)) || names.some(n => nameMatches(n, t2Terms))

    if (hasT1 && hasT2) return gameId
  }

  // 3. R32+: match by team names stored in tournament_games
  //    These are populated by the propagation step below once R64 is done.
  for (const dbGame of dbGames) {
    if (dbGame.round === 0) continue            // R64 already handled above
    if (!dbGame.team1 || !dbGame.team2) continue
    if (dbGame.status === 'final') continue

    const t1 = dbGame.team1.toLowerCase()
    const t2 = dbGame.team2.toLowerCase()
    const locs = competitors.map(c => c.team.location.toLowerCase())

    const matchT1 = locs.some(l => l.includes(t1) || t1.includes(l))
    const matchT2 = locs.some(l => l.includes(t2) || t2.includes(l))

    if (matchT1 && matchT2) return dbGame.game_id
  }

  return null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url)

  try {
    const supabase = await createClient()

    // Check manual-mode flag
    const { data: modeSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'results_mode')
      .single()

    if (modeSetting?.value === 'manual') {
      return NextResponse.json({ mode: 'manual', message: 'ESPN sync disabled — using manual mode.' })
    }

    // Load all tournament_games from DB
    const { data: dbGames, error: dbError } = await supabase
      .from('tournament_games')
      .select('game_id, round, region, team1, team2, winner, status, espn_event_id')

    if (dbError || !dbGames) {
      return NextResponse.json({ error: "Could not load tournament games from DB", detail: dbError?.message ?? "unknown", hint: dbError?.hint ?? null, code: dbError?.code ?? null }, { status: 500 })
    }

    // Build espn_event_id → game_id index
    const eventIdIndex = new Map<string, string>()
    for (const g of dbGames) {
      if (g.espn_event_id) eventIdIndex.set(g.espn_event_id, g.game_id)
    }

    // Fetch ESPN
    const dates = getDatesToFetch(url)
    const events = await fetchESPNDays(dates)

    // ── Match events and build update payloads ────────────────────────────────

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
    }

    const updates: GameUpdate[] = []
    const matchLog: string[] = []

    for (const event of events) {
      const gameId = matchEventToGameId(event, dbGames, eventIdIndex)
      if (!gameId) continue

      // Store so later events in the same batch don't re-match the same game
      eventIdIndex.set(event.id, gameId)

      const dbGame = dbGames.find(g => g.game_id === gameId)
      const { score1, score2, winner } = getScoresFromEvent(
        event,
        gameId,
        dbGame?.team1,
        dbGame?.team2
      )

      updates.push({
        game_id: gameId,
        espn_event_id: event.id,
        status: getStatusFromEvent(event),
        tv: getTVFromEvent(event),
        venue: getVenueFromEvent(event),
        game_time: getGameTimeFromEvent(event),
        score1,
        score2,
        winner,
      })

      matchLog.push(`${gameId} → ESPN ${event.id} (${event.name}) [${getStatusFromEvent(event)}]`)
    }

    // ── Write updates to Supabase ─────────────────────────────────────────────

    let updatedCount = 0
    let errorCount = 0

    for (const u of updates) {
      const payload: Record<string, unknown> = {
        espn_event_id: u.espn_event_id,
        status: u.status,
        tv: u.tv,
        venue: u.venue,
        game_time: u.game_time,
        score1: u.score1,
        score2: u.score2,
        updated_at: new Date().toISOString(),
      }

      // Only overwrite winner if ESPN has a definitive result
      // (don't clobber manually-entered winners with null)
      if (u.winner !== null) payload.winner = u.winner

      const { error } = await supabase
        .from('tournament_games')
        .update(payload)
        .eq('game_id', u.game_id)

      if (error) { errorCount++; console.error(`Update failed for ${u.game_id}:`, error) }
      else updatedCount++
    }

    // ── Propagate R64 winners → R32 team slots ────────────────────────────────
    //
    // When a R64 game is complete, the winner's name should be written into
    // the next round's team1 or team2 column so that:
    //   a) The admin page shows the correct matchup
    //   b) R32+ ESPN matching (strategy 3 above) works
    //
    // We do this by reading ALL final R64 games (not just the ones we just updated)
    // so that re-running the sync is idempotent.

    const { data: r64Results } = await supabase
      .from('tournament_games')
      .select('game_id, round, team1, team2, winner')
      .eq('round', 0)
      .not('winner', 'is', null)

    let propagated = 0

    if (r64Results) {
      for (const r64 of r64Results) {
        if (!r64.winner) continue

        const winnerName = r64.winner === 1 ? r64.team1 : r64.team2
        if (!winnerName) continue

        const next = getNextRoundSlot(r64.game_id, r64.winner as 1 | 2)
        if (!next) continue

        const updateField = next.teamSlot === 1 ? { team1: winnerName } : { team2: winnerName }

        const { error } = await supabase
          .from('tournament_games')
          .update(updateField)
          .eq('game_id', next.nextGameId)
          // Don't overwrite if already set (prevents race conditions)
          .is(next.teamSlot === 1 ? 'team1' : 'team2', null)

        if (!error) propagated++
      }
    }

    // ── Response ──────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      datesChecked: dates,
      espnEventsFound: events.length,
      gamesMatched: updates.length,
      gamesUpdated: updatedCount,
      errors: errorCount,
      r32SlotsPopulated: propagated,
      matches: matchLog,
    })

  } catch (err) {
    console.error('ESPN sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
