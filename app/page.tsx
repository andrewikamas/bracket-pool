import { createClient } from '@/lib/supabase/server'
import TVScheduleButton from '@/components/TVScheduleButton'
import AICommentary from '@/components/AICommentary'
import ChampionBadge from '@/components/ChampionBadge'

export const dynamic = 'force-dynamic'

// Mirrors REGIONS data from NCAABracket.jsx — needed to resolve team names
const REGIONS: Record<string, { games: { id: string; team1: string; team2: string }[] }> = {
  South: { games: [
    { id: 'S1', team1: 'Florida',        team2: 'PV A&M/Lehigh'  },
    { id: 'S2', team1: 'Clemson',         team2: 'Iowa'            },
    { id: 'S3', team1: 'Vanderbilt',      team2: 'McNeese'         },
    { id: 'S4', team1: 'Nebraska',        team2: 'Troy'            },
    { id: 'S5', team1: 'North Carolina',  team2: 'VCU'             },
    { id: 'S6', team1: 'Illinois',        team2: 'Penn'            },
    { id: 'S7', team1: "Saint Mary's",    team2: 'Texas A&M'       },
    { id: 'S8', team1: 'Houston',         team2: 'Idaho'           },
  ]},
  East: { games: [
    { id: 'E1', team1: 'Duke',            team2: 'Siena'           },
    { id: 'E2', team1: 'Ohio St.',        team2: 'TCU'             },
    { id: 'E3', team1: "St. John's",      team2: 'Northern Iowa'   },
    { id: 'E4', team1: 'Kansas',          team2: 'Cal Baptist'     },
    { id: 'E5', team1: 'Louisville',      team2: 'South Florida'   },
    { id: 'E6', team1: 'Michigan St.',    team2: 'N. Dakota St.'   },
    { id: 'E7', team1: 'UCLA',            team2: 'UCF'             },
    { id: 'E8', team1: 'UConn',           team2: 'Furman'          },
  ]},
  West: { games: [
    { id: 'W1', team1: 'Arizona',         team2: 'LIU'             },
    { id: 'W2', team1: 'Villanova',       team2: 'Utah St.'        },
    { id: 'W3', team1: 'Wisconsin',       team2: 'High Point'      },
    { id: 'W4', team1: 'Arkansas',        team2: 'Hawaii'          },
    { id: 'W5', team1: 'BYU',            team2: 'Texas/NC State'  },
    { id: 'W6', team1: 'Gonzaga',         team2: 'Kennesaw St.'    },
    { id: 'W7', team1: 'Miami (FL)',      team2: 'Missouri'        },
    { id: 'W8', team1: 'Purdue',          team2: 'Queens'          },
  ]},
  Midwest: { games: [
    { id: 'M1', team1: 'Michigan',        team2: 'UMBC/Howard'     },
    { id: 'M2', team1: 'Georgia',         team2: 'Saint Louis'     },
    { id: 'M3', team1: 'Texas Tech',      team2: 'Akron'           },
    { id: 'M4', team1: 'Alabama',         team2: 'Hofstra'         },
    { id: 'M5', team1: 'Tennessee',       team2: 'SMU/Miami (OH)'  },
    { id: 'M6', team1: 'Virginia',        team2: 'Wright St.'      },
    { id: 'M7', team1: 'Kentucky',        team2: 'Santa Clara'     },
    { id: 'M8', team1: 'Iowa St.',        team2: 'Tennessee St.'   },
  ]},
}

// Resolves which team a bracket picked as champion by tracing the full pick path
function resolveChampion(picks: Record<string, number>): string | null {
  const champPick = picks['CHAMP']
  if (!champPick) return null

  // CHAMP 1 = FF1 winner, 2 = FF2 winner
  const ffGame = champPick === 1 ? 'FF1' : 'FF2'
  const ffPick = picks[ffGame]
  if (!ffPick) return null

  // FF1: 1=South, 2=East  |  FF2: 1=West, 2=Midwest
  let region: string
  if (ffGame === 'FF1') region = ffPick === 1 ? 'South' : 'East'
  else region = ffPick === 1 ? 'West' : 'Midwest'

  const r = region[0]

  // Trace Elite 8 → Sweet 16 → R32 → R64
  const e8Pick = picks[`${r}R3G0`]
  if (!e8Pick) return null

  const s16Slot = e8Pick - 1                          // 0 or 1
  const s16Pick = picks[`${r}R2G${s16Slot}`]
  if (!s16Pick) return null

  const r32Slot = s16Slot * 2 + (s16Pick - 1)        // 0–3
  const r32Pick = picks[`${r}R1G${r32Slot}`]
  if (!r32Pick) return null

  const r64Slot = r32Slot * 2 + (r32Pick - 1)        // 0–7
  const r64Game = REGIONS[region].games[r64Slot]
  const r64Pick = picks[r64Game.id]
  if (!r64Pick) return null

  return r64Pick === 1 ? r64Game.team1 : r64Game.team2
}

interface LeaderboardEntry {
  bracket_id: string
  bracket_name: string
  display_name: string
  score: number
  picks_made: number
  tiebreaker: number | null
  champion_pick: string | null
}

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()

  const [
    { data: brackets },
    { data: games },
    { data: scoringSetting },
    { data: lockSetting },
    { data: pickCounts },
    // Paginate picks to get past the 1000-row default cap
    { data: picks1 },
    { data: picks2 },
  ] = await Promise.all([
    supabase.from('brackets').select('id, name, tiebreaker, profiles(display_name)'),
    supabase.from('tournament_games').select('game_id, round, winner'),
    supabase.from('app_settings').select('value').eq('key', 'scoring').single(),
    supabase.from('app_settings').select('value').eq('key', 'lock_time').single(),
    supabase.from('bracket_pick_counts').select('bracket_id, pick_count'),
    supabase.from('picks').select('bracket_id, game_id, winner_choice').range(0, 999),
    supabase.from('picks').select('bracket_id, game_id, winner_choice').range(1000, 1999),
  ])

  const allPicks = [...(picks1 ?? []), ...(picks2 ?? [])]

  const lockTime = lockSetting?.value
    ? new Date(lockSetting.value as string)
    : new Date('2026-03-19T17:30:00Z')
  const isLocked = new Date() >= lockTime

  const scoring: Record<string, number> =
    (scoringSetting?.value as any) ?? { '0': 2, '1': 3, '2': 5, '3': 8, '4': 12, '5': 25 }
  const results = new Map(
    (games ?? []).filter((g) => g.winner).map((g) => [g.game_id, { round: g.round, winner: g.winner }])
  )

  const pickCountMap = new Map((pickCounts ?? []).map((p: any) => [p.bracket_id, p.pick_count as number]))

  // Build per-bracket pick maps for scoring + champion resolution
  const bracketPickMaps = new Map<string, Record<string, number>>()
  for (const p of allPicks) {
    if (!bracketPickMaps.has(p.bracket_id)) bracketPickMaps.set(p.bracket_id, {})
    bracketPickMaps.get(p.bracket_id)![p.game_id] = p.winner_choice
  }

  const entries: LeaderboardEntry[] = (brackets ?? []).map((b) => {
    const pickMap = bracketPickMaps.get(b.id) ?? {}
    let score = 0
    for (const [gameId, choice] of Object.entries(pickMap)) {
      const result = results.get(gameId)
      if (result && result.winner === choice) {
        score += scoring[result.round.toString()] ?? 0
      }
    }
    return {
      bracket_id: b.id,
      bracket_name: b.name,
      display_name: (b.profiles as any)?.display_name ?? 'Unknown',
      score,
      picks_made: pickCountMap.get(b.id) ?? 0,
      tiebreaker: b.tiebreaker,
      champion_pick: isLocked ? resolveChampion(pickMap) : null,
    }
  })

  return entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (a.tiebreaker ?? 999) - (b.tiebreaker ?? 999)
  })
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard()
  const hasChampPicks = leaderboard.some((e) => e.champion_pick)

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>🏀 2026 NCAA Bracket Pool</h1>
          <p style={{ color: '#6b7280', marginTop: 4, fontSize: 13 }}>
            Brackets lock Thu Mar 19 at 1:30 PM ET · Scores update as games complete
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TVScheduleButton />
          <a
            href="/my-brackets"
            style={{
              padding: '9px 18px',
              background: '#2563eb',
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 14,
              whiteSpace: 'nowrap',
            }}
          >
            My Brackets →
          </a>
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f9fafb', borderRadius: 12, color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏀</div>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#6b7280' }}>No brackets submitted yet</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>
            <a href="/my-brackets" style={{ color: '#2563eb' }}>Be the first — fill out your bracket →</a>
          </div>
        </div>
      ) : (
        <>
          <AICommentary leaderboard={leaderboard} />

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['#', 'Bracket', 'Player', hasChampPicks ? '🏆 Champion' : null, 'Score', 'Picks']
                  .filter(Boolean)
                  .map((h, i) => (
                    <th
                      key={h as string}
                      style={{
                        padding: '8px 12px',
                        fontWeight: 600,
                        color: '#374151',
                        textAlign: (hasChampPicks ? i >= 4 : i >= 3) ? 'right' : 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => {
                const incomplete = entry.picks_made < 63
                return (
                  <tr key={entry.bracket_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '11px 12px', color: '#9ca3af', fontWeight: 500, width: 32 }}>{i + 1}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <a
                        href={`/bracket/${entry.bracket_id}`}
                        style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {entry.bracket_name}
                      </a>
                    </td>
                    <td style={{ padding: '11px 12px', color: '#374151' }}>{entry.display_name}</td>
                    {hasChampPicks && (
                      <td style={{ padding: '11px 12px', color: '#6b7280', fontSize: 13 }}>
                        {entry.champion_pick
                          ? <ChampionBadge champion={entry.champion_pick} />
                          : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    )}
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{entry.score}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                      {incomplete ? (
                        <span
                          title={`${63 - entry.picks_made} picks missing`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: '#d97706',
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          ⚠ {entry.picks_made}/63
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>63/63</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 32, textAlign: 'center' }}>
        Scoring: R64 ×2 · R32 ×3 · S16 ×5 · E8 ×8 · FF ×12 · Championship ×25
      </p>
    </div>
  )
}
