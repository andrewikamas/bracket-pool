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

// Bracket name → real person name mapping
const BRACKET_TO_PERSON: Record<string, string> = {
  'JuJu FC':                 'Julian (Juju)',
  'Russel GOAT':             'Russell',
  "Venny's Bracket":         'Venny',
  'Venny\u2019s Bracket':    'Venny',  // curly apostrophe variant
  'AIxAI':                   'Andrew',
  '= Not My Favorite':       'Sarah',
  'Uncle Fancy':             'Adam',
  'Laura I':                 'Laura',
  'Liv says hi!':            'Olivia',
  'adalyn':                  'Adalyn',
  'Dave\'s':                 'Dave',
  'Dave\u2019s':             'Dave',  // curly apostrophe variant
  'Seana Bird':              'Seana',
  'Saya':                    'Saya',
  'D Mon$y':                 'Dana',
  'Calmer than you are...':  'Alec',
  'Calmer than you are\u2026': 'Alec',  // unicode ellipsis variant
  'Aunt Dee Dee':            'Delores',
  'This is AJ':              'AJ',
  'Pooks Picks':             'Jim',
  'Lucille':                 'Lucille',
}

export async function POST(req: Request) {
  try {
    const { leaderboard } = await req.json()
    const supabase = await createClient()

    // Fetch completed games, champ picks, and bracket info
    // Only fetch picks for completed games + CHAMP to avoid row cap
    const completedGameIds = ((await supabase
      .from('tournament_games')
      .select('game_id, round, winner')
      .not('winner', 'is', null)).data ?? [])

    const completedGames = completedGameIds
    const gameIds = completedGames.map((g: any) => g.game_id)

    const [{ data: scoringPicksData }, { data: champPicksData }, { data: brackets }] = await Promise.all([
      gameIds.length > 0
        ? supabase.from('picks').select('bracket_id, game_id, winner_choice').in('game_id', gameIds)
        : Promise.resolve({ data: [] }),
      supabase.from('picks').select('bracket_id, winner_choice').eq('game_id', 'CHAMP'),
      supabase.from('brackets').select('id, name, profiles(display_name)'),
    ])

    const bracketMap = new Map(
      (brackets ?? []).map((b: any) => [
        b.id,
        { name: b.name, display: (b.profiles as any)?.display_name ?? b.name },
      ])
    )
    const allPicks = scoringPicksData ?? []

    // ── Group leaderboard by PERSON (not bracket) ─────────────────────────────
    // Each person's score = their BEST bracket score. Show one row per person.
    const personMap = new Map<string, { person: string; bestScore: number; brackets: string[]; incomplete: number }>()
    for (const entry of (leaderboard as any[])) {
      const person = BRACKET_TO_PERSON[entry.bracket_name] ?? entry.bracket_name
      const existing = personMap.get(person)
      if (!existing) {
        personMap.set(person, {
          person,
          bestScore: entry.score,
          brackets: [entry.bracket_name],
          incomplete: entry.picks_made < 63 ? 1 : 0,
        })
      } else {
        existing.bestScore = Math.max(existing.bestScore, entry.score)
        existing.brackets.push(entry.bracket_name)
        if (entry.picks_made < 63) existing.incomplete++
      }
    }

    // Sort by best score desc
    const personStandings = [...personMap.values()].sort((a, b) => b.bestScore - a.bestScore)

    // Build standings text — one line per person
    let rank = 1
    const standingsLines: string[] = []
    for (let i = 0; i < personStandings.length; i++) {
      const p = personStandings[i]
      // Assign tied ranks correctly
      if (i > 0 && personStandings[i].bestScore < personStandings[i - 1].bestScore) rank = i + 1
      const multiNote = p.brackets.length > 1 ? ` (${p.brackets.length} brackets)` : ''
      const incompleteNote = p.incomplete > 0 ? ` ⚠ incomplete picks` : ''
      standingsLines.push(`${rank}. ${p.person}${multiNote} — ${p.bestScore} pts${incompleteNote}`)
    }
    const standingsText = standingsLines.join('\n')

    // ── Champion picks — resolve 1/2 to actual team name ─────────────────────
    const champLines: string[] = []
    for (const cp of (champPicksData ?? [])) {
      const b = bracketMap.get(cp.bracket_id)
      if (!b) continue
      const person = BRACKET_TO_PERSON[b.name] ?? b.name
      // winner_choice 1 or 2 — look up team from R64 CHAMP path isn't available here,
      // so just note the bracket name which the AI prompt key can resolve
      champLines.push(`${person} (${b.name})`)
    }
    // Deduplicate by person
    const uniqueChampLines = [...new Set(champLines)]

    // ── Upset analysis — game.winner is 1 or 2, not a team name ──────────────
    const upsetLines: string[] = []
    for (const game of completedGames) {
      const ref = R64_GAMES[(game as any).game_id]
      if (!ref || !(game as any).winner) continue

      // winner is 1 (team1 won) or 2 (team2 won)
      const winnerNum = (game as any).winner as 1 | 2
      const winnerTeam = winnerNum === 1 ? ref.team1 : ref.team2
      const winnerSeed = winnerNum === 1 ? ref.seed1 : ref.seed2
      const loserSeed  = winnerNum === 1 ? ref.seed2 : ref.seed1

      if (winnerSeed <= loserSeed) continue // favorite won, skip

      // Who called this upset? winner_choice matches winnerNum
      const callerIds = allPicks
        .filter((p: any) => p.game_id === (game as any).game_id && p.winner_choice === winnerNum)
        .map((p: any) => {
          const b = bracketMap.get(p.bracket_id)
          return b ? (BRACKET_TO_PERSON[b.name] ?? b.name) : 'Unknown'
        })
      const uniqueCallers = [...new Set(callerIds)]

      const callerText = uniqueCallers.length === 0
        ? 'nobody called it'
        : `called by: ${uniqueCallers.join(', ')}`

      upsetLines.push(`${winnerTeam} (${winnerSeed}-seed) upset the ${loserSeed}-seed — ${callerText}`)
    }

    const champText = uniqueChampLines.length > 0
      ? uniqueChampLines.join(', ')
      : 'No championship picks locked in yet'

    const upsetText = upsetLines.length > 0
      ? upsetLines.join('\n')
      : 'No upsets yet — chalk is holding so far'

    const totalCompleted = completedGames.length

    const prompt = `You are the color commentator for a family March Madness bracket pool called the Ikamas Family Bracket Pool. Write fun, SPECIFIC commentary using the real names from the data below.

PEOPLE IN THE POOL:
Andrew (MSU fan, pool organizer, has multiple brackets for his kids), Sarah (Andrew's wife), Julian/Juju (Andrew's son, age 11), Russell (Andrew's son, age 8), Venny (Andrew's daughter, age 4), Adam (Andrew's brother), Laura (Adam's wife), Olivia (Adam's daughter, age 9), Adalyn (Adam's daughter, Olivia's sister), Dave (Andrew's cousin), Seana (Dave's wife), Saya (Seana's sister), Dana (Andrew's cousin, Dave's sister), Alec (Dana's husband), Delores (Andrew's aunt, Dave and Dana's mom), Jim (Laura Pukall's husband, Andrew's cousin-in-law, Wisconsin fan), AJ (Jim and Laura Pukall's son, Andrew's nephew), Lucille (Jim and Laura Pukall's daughter, AJ's sister).

ABSOLUTE RULES:
1. NEVER tease or trash-talk minors — Venny (4), Juju (11), Russell (8), Olivia (9), Adalyn (13), Lucille (16). They get only celebration and encouragement.
2. If JP appears anywhere, treat with complete warmth and reverence — never tease.
3. "Spicy" banter is only for adults: Andrew, Sarah, Adam, Laura, Dave, Seana, Saya, Dana, Alec, Delores, AJ (age 20).
4. Standings are shown ONE ROW PER PERSON (best bracket score). Don't say "X brackets tied" — say "X people tied."
5. Andrew has multiple brackets because his young kids each filled one out — don't mock this, it's sweet.

CURRENT STANDINGS — one row per person, ${totalCompleted} games completed (${standingsText.split('\n').length} people):
${standingsText}

WHO PICKED THE CHAMPION:
${champText}

UPSETS SO FAR:
${upsetText}

Write exactly 2-3 sentences for EACH tone. Be specific — use real first names. If no games completed yet, hype the anticipation and bold picks.

TONE 1 "family": Warm, enthusiastic. Celebrate leaders, highlight smart picks, pure good vibes for all ages.
TONE 2 "spicy": Light affectionate trash talk at adults only. Tease bad adult picks, celebrate upsets that busted brackets — fun and loving, never mean.

Return ONLY valid JSON with exactly two string keys: "family" and "spicy". No markdown, no explanation.`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
