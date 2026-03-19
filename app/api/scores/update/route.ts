// app/api/scores/update/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { updates, updateWinners } = await request.json()

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

      if (updateWinners) {
        if (u.winner != null) payload.winner = u.winner
        if (u.score1 != null) payload.score1 = u.score1
        if (u.score2 != null) payload.score2 = u.score2
        payload.status = 'post'
      } else {
        if (u.tv)        payload.tv = u.tv
        if (u.game_time) payload.game_time = u.game_time
        if (u.venue)     payload.venue = u.venue
      }

      const { error } = await supabase
        .from('tournament_games')
        .update(payload)
        .eq('game_id', u.game_id)

      if (error) { errors++; console.error(`Update failed for ${u.game_id}:`, error) }
      else updated++
    }

    // Propagate R64 winners → R32 team slots so next round matchups are known
    if (updateWinners) {
      const { data: r64Results } = await supabase
        .from('tournament_games')
        .select('game_id, round, team1, team2, winner')
        .eq('round', 0)
        .not('winner', 'is', null)

      const nextGameMap: Record<string, { nextGameId: string; teamSlot: 1 | 2 }> = {
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
      }

      for (const r64 of r64Results ?? []) {
        if (!r64.winner) continue
        const winnerName = r64.winner === 1 ? r64.team1 : r64.team2
        if (!winnerName) continue
        const next = nextGameMap[r64.game_id]
        if (!next) continue
        const field = next.teamSlot === 1 ? 'team1' : 'team2'
        await supabase
          .from('tournament_games')
          .update({ [field]: winnerName })
          .eq('game_id', next.nextGameId)
          .is(field, null)
      }
    }

    return NextResponse.json({ success: true, updated, errors })
  } catch (err) {
    console.error('Score update error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
