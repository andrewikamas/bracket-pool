import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Static R64 seed/team lookup so we can flag upsets in the prompt
const R64_GAMES: Record<string, { team1: string; seed1: number; team2: string; seed2: number }> = {
  S1: { seed1: 1, team1: 'Florida',        seed2: 16, team2: 'PV A&M/Lehigh'   },
  S2: { seed1: 8, team1: 'Clemson',         seed2: 9,  team2: 'Iowa'             },
  S3: { seed1: 5, team1: 'Vanderbilt',      seed2: 12, team2: 'McNeese'          },
  S4: { seed1: 4, team1: 'Nebraska',        seed2: 13, team2: 'Troy'             },
  S5: { seed1: 6, team1: 'North Carolina',  seed2: 11, team2: 'VCU'             },
  S6: { seed1: 3, team1: 'Illinois',        seed2: 14, team2: 'Penn'             },
  S7: { seed1: 7, team1: "Saint Mary's",    seed2: 10, team2: 'Texas A&M'        },
  S8: { seed1: 2, team1: 'Houston',         seed2: 15, team2: 'Idaho'            },
  E1: { seed1: 1, team1: 'Duke',            seed2: 16, team2: 'Siena'            },
  E2: { seed1: 8, team1: 'Ohio St.',        seed2: 9,  team2: 'TCU'              },
  E3: { seed1: 5, team1: "St. John's",      seed2: 12, team2: 'Northern Iowa'    },
  E4: { seed1: 4, team1: 'Kansas',          seed2: 13, team2: 'Cal Baptist'      },
  E5: { seed1: 6, team1: 'Louisville',      seed2: 11, team2: 'South Florida'    },
  E6: { seed1: 3, team1: 'Michigan St.',    seed2: 14, team2: 'N. Dakota St.'    },
  E7: { seed1: 7, team1: 'UCLA',            seed2: 10, team2: 'UCF'              },
  E8: { seed1: 2, team1: 'UConn',           seed2: 15, team2: 'Furman'           },
  W1: { seed1: 1, team1: 'Arizona',         seed2: 16, team2: 'LIU'             },
  W2: { seed1: 8, team1: 'Villanova',       seed2: 9,  team2: 'Utah St.'         },
  W3: { seed1: 5, team1: 'Wisconsin',       seed2: 12, team2: 'High Point'       },
  W4: { seed1: 4, team1: 'Arkansas',        seed2: 13, team2: 'Hawaii'           },
  W5: { seed1: 6, team1: 'BYU',            seed2: 11, team2: 'Texas/NC State'   },
  W6: { seed1: 3, team1: 'Gonzaga',         seed2: 14, team2: 'Kennesaw St.'     },
  W7: { seed1: 7, team1: 'Miami (FL)',      seed2: 10, team2: 'Missouri'         },
  W8: { seed1: 2, team1: 'Purdue',          seed2: 15, team2: 'Queens'           },
  M1: { seed1: 1, team1: 'Michigan',        seed2: 16, team2: 'UMBC/Howard'      },
  M2: { seed1: 8, team1: 'Georgia',         seed2: 9,  team2: 'Saint Louis'      },
  M3: { seed1: 5, team1: 'Texas Tech',      seed2: 12, team2: 'Akron'            },
  M4: { seed1: 4, team1: 'Alabama',         seed2: 13, team2: 'Hofstra'          },
  M5: { seed1: 6, team1: 'Tennessee',       seed2: 11, team2: 'SMU/Miami (OH)'   },
  M6: { seed1: 3, team1: 'Virginia',        seed2: 14, team2: 'Wright St.'       },
  M7: { seed1: 7, team1: 'Kentucky',        seed2: 10, team2: 'Santa Clara'      },
  M8: { seed1: 2, team1: 'Iowa St.',        seed2: 15, team2: 'Tennessee St.'    },
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_commentary')
      .single()

    return NextResponse.json({ commentary: data?.value ?? null })
  } catch {
    return NextResponse.json({ commentary: null })
  }
}

export async function POST(req: Request) {
  try {
    const { leaderboard } = await req.json()
    const supabase = await createClient()

    // Fetch completed games and all picks
    const [{ data: games }, { data: picks }, { data: brackets }] = await Promise.all([
      supabase.from('tournament_games').select('game_id, round, winner').not('winner', 'is', null),
      supabase.from('picks').select('bracket_id, game_id, winner_choice'),
      supabase.from('brackets').select('id, name, profiles(display_name)'),
    ])

    const bracketMap = new Map(
      (brackets ?? []).map((b) => [
        b.id,
        { name: b.name, display: (b.profiles as any)?.display_name ?? b.name },
      ])
    )
    const allPicks = picks ?? []
    const completedGames = games ?? []

    // Champion picks
    const champPicks = allPicks
      .filter((p) => p.game_id === 'CHAMP')
      .map((p) => {
        const b = bracketMap.get(p.bracket_id)
        return `${b?.display ?? 'Unknown'} → ${p.winner_choice}`
      })

    // Upset analysis for R64 games
    const upsetLines: string[] = []
    for (const game of completedGames) {
      const ref = R64_GAMES[game.game_id]
      if (!ref || !game.winner) continue
      const winnerSeed = game.winner === ref.team1 ? ref.seed1 : ref.seed2
      const loserSeed  = game.winner === ref.team1 ? ref.seed2 : ref.seed1
      if (winnerSeed <= loserSeed) continue // favorite won, skip

      const callers = allPicks
        .filter((p) => p.game_id === game.game_id && p.winner_choice === game.winner)
        .map((p) => bracketMap.get(p.bracket_id)?.display ?? 'Unknown')

      const callerText =
        callers.length === 0
          ? 'nobody called it'
          : `called by: ${callers.join(', ')}`

      upsetLines.push(`${game.winner} (${winnerSeed}-seed) beat the ${loserSeed}-seed — ${callerText}`)
    }

    // Correct picks per person on completed games (for "hot start" narrative)
    const correctByBracket = new Map<string, number>()
    for (const pick of allPicks) {
      const game = completedGames.find((g) => g.game_id === pick.game_id)
      if (game && game.winner === pick.winner_choice) {
        correctByBracket.set(pick.bracket_id, (correctByBracket.get(pick.bracket_id) ?? 0) + 1)
      }
    }

    const standingsText = (leaderboard as any[])
      .map(
        (e, i) =>
          `${i + 1}. ${e.bracket_name} (${e.display_name}) — ${e.score} pts${
            e.picks_made < 63 ? `, ⚠ only ${e.picks_made}/63 picks submitted` : ''
          }`
      )
      .join('\n')

    const champText =
      champPicks.length > 0
        ? champPicks.join(' | ')
        : 'No championship picks locked in yet'

    const upsetText =
      upsetLines.length > 0
        ? upsetLines.join('\n')
        : 'No upsets yet — chalk is holding so far'

    const totalCompleted = completedGames.length

    const prompt = `You are the color commentator for a family March Madness bracket pool called the Ikamas Family Bracket Pool. Write fun, SPECIFIC commentary using the real names and teams from the data below.

CURRENT STANDINGS (${totalCompleted} games completed so far):
${standingsText}

CHAMPIONSHIP PICKS:
${champText}

UPSET RESULTS:
${upsetText}

Write exactly 2-3 sentences for EACH of two tones. Be specific — name real people and teams from the data. If no games have completed yet, write about the anticipation, the bold championship picks, and who's poised for glory.

TONE 1 "family": Warm, enthusiastic sports-hype voice. Celebrate who's leading, highlight smart picks, make everyone feel excited to be in the pool. Pure good vibes.

TONE 2 "spicy": Light, affectionate trash talk. Tease the people in last place, celebrate upsets that busted brackets, playfully roast bad picks — but keep it clearly fun and loving, not mean.

Return ONLY valid JSON with exactly two string keys: "family" and "spicy". No markdown fences, no explanation outside the JSON.`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const anthropicData = await anthropicRes.json()
    const rawText: string = anthropicData.content?.[0]?.text ?? ''

    let parsed: { family: string; spicy: string }
    try {
      parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim())
    } catch {
      parsed = {
        family: rawText || 'The tournament is underway — check back soon for the full breakdown!',
        spicy: rawText || "The bracket carnage hasn't started yet. Stay tuned.",
      }
    }

    const commentary = {
      family: parsed.family,
      spicy: parsed.spicy,
      generated_at: new Date().toISOString(),
    }

    // Cache using service role (bypasses RLS on app_settings)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await serviceClient
      .from('app_settings')
      .upsert({ key: 'ai_commentary', value: commentary }, { onConflict: 'key' })

    return NextResponse.json({ commentary })
  } catch (err) {
    console.error('Commentary generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 })
  }
}
