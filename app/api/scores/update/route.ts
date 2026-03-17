// app/api/scores/update/route.ts
// Accepts ESPN game schedule data POSTed from the client browser
// (ESPN blocks server-side fetches from Vercel IPs, so we fetch client-side
//  and POST the results here to persist them in Supabase)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { updates } = await request.json()

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let updated = 0
    for (const u of updates) {
      if (!u.game_id) continue
      const { error } = await supabase
        .from('tournament_games')
        .update({
          tv: u.tv,
          game_time: u.game_time,
          venue: u.venue,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', u.game_id)

      if (!error) updated++
    }

    return NextResponse.json({ success: true, updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
