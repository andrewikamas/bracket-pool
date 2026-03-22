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

    // If updating winners, load team names upfront so we can resolve winnerName → 1|2
    let gameTeamMap = new Map<string, { team1: string; team2: string }>()
    if (updateWinners) {
      const { data: gameRows } = await supabase
        .from('tournament_games')
        .select('game_id, team1, team2')
      gameTeamMap = new Map(
        (gameRows ?? []).map((g: any) => [g.game_id, { team1: g.team1 ?? '', team2: g.team2 ?? '' }])
      )
    }

    for (const u of updates) {
      if (!u.game_id) continue

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (updateWinners) {
        if (u.winner != null) {
          payload.winner = u.winner
        } else if (u.winnerName) {
          const gameTeams = gameTeamMap.get(u.game_id)
          if (gameTeams) {
            const wl = (u.winnerName as string).toLowerCase()
            const t1 = gameTeams.team1.toLowerCase()
            const t2 = gameTeams.team2.toLowerCase()
            if (t1 && (wl.includes(t1.split(' ')[0]) || t1.split(' ')[0].includes(wl.split(' ')[0]))) {
              payload.winner = 1
            } else if (t2 && (wl.includes(t2.split(' ')[0]) || t2.split(' ')[0].includes(wl.split(' ')[0]))) {
              payload.winner = 2
            }
          }
        }
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

    // Propagate completed game winners into next round's team slots
    if (updateWinners) {
      const { data: completedGames } = await supabase
        .from('tournament_games')
        .select('game_id, round, team1, team2, winner')
        .not('winner', 'is', null)

      // Maps any completed game → the next round slot it feeds into
      const nextGameMap: Record<string, { nextGameId: string; teamSlot: 1 | 2 }> = {
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
      }

      for (const game of completedGames ?? []) {
        if (!game.winner) continue
        const winnerName = game.winner === 1 ? game.team1 : game.team2
        if (!winnerName) continue
        const next = nextGameMap[game.game_id]
        if (!next) continue
        const field = next.teamSlot === 1 ? 'team1' : 'team2'
        await supabase
          .from('tournament_games')
          .update({ [field]: winnerName })
          .eq('game_id', next.nextGameId)
          .is(field, null) // don't overwrite if already set
      }
    }

    return NextResponse.json({ success: true, updated, errors })
  } catch (err) {
    console.error('Score update error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
