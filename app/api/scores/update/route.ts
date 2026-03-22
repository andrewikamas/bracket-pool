// app/api/scores/update/route.ts
//
// METADATA ONLY — updates TV, venue, game_time on tournament_games.
// All winner/score writes go through /api/scores (POST) which uses
// the safe name-matching logic in lib/espn.ts.
//
// The old updateWinners code path has been removed because it used
// fuzzy first-word matching that caused incorrect winner assignments.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { updates, updateWinners } = await request.json()

    // BLOCK winner writes through this route
    if (updateWinners) {
      return NextResponse.json({
        error: 'Winner updates are no longer accepted through this endpoint. Use /api/scores (POST) instead.',
      }, { status: 400 })
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let updated = 0
    let errors = 0

    for (const u of updates) {
      if (!u.game_id) continue

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      // Metadata only — never touch winner, score1, score2, or status
      if (u.tv)        payload.tv = u.tv
      if (u.game_time) payload.game_time = u.game_time
      if (u.venue)     payload.venue = u.venue

      const { error } = await supabase
        .from('tournament_games')
        .update(payload)
        .eq('game_id', u.game_id)

      if (error) { errors++; console.error(`Update failed for ${u.game_id}:`, error) }
      else updated++
    }

    return NextResponse.json({ success: true, updated, errors })
  } catch (err) {
    console.error('Score update error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
