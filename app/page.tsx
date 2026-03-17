import { createClient } from '@/lib/supabase/server'
import TVScheduleButton from '@/components/TVScheduleButton'

interface LeaderboardEntry {
  bracket_id: string
  bracket_name: string
  display_name: string
  score: number
  picks_made: number
  tiebreaker: number | null
}

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()

  const [{ data: brackets }, { data: games }, { data: allPicks }, { data: scoringSetting }] =
    await Promise.all([
      supabase.from('brackets').select('id, name, tiebreaker, profiles(display_name)'),
      supabase.from('tournament_games').select('game_id, round, winner'),
      supabase.from('picks').select('bracket_id, game_id, winner_choice'),
      supabase.from('app_settings').select('value').eq('key', 'scoring').single(),
    ])

  const scoring: Record<string, number> =
    (scoringSetting?.value as any) ?? { '0': 2, '1': 3, '2': 5, '3': 8, '4': 12, '5': 25 }
  const results = new Map((games ?? []).map((g) => [g.game_id, { round: g.round, winner: g.winner }]))
  const picks = allPicks ?? []

  const entries: LeaderboardEntry[] = (brackets ?? []).map((b) => {
    const bracketPicks = picks.filter((p) => p.bracket_id === b.id)
    let score = 0
    for (const pick of bracketPicks) {
      const result = results.get(pick.game_id)
      if (result && result.winner === pick.winner_choice) {
        score += scoring[result.round.toString()] ?? 0
      }
    }
    return {
      bracket_id: b.id,
      bracket_name: b.name,
      display_name: (b.profiles as any)?.display_name ?? 'Unknown',
      score,
      picks_made: bracketPicks.length,
      tiebreaker: b.tiebreaker,
    }
  })

  return entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (a.tiebreaker ?? 999) - (b.tiebreaker ?? 999)
  })
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard()

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>🏀 2026 NCAA Bracket Pool</h1>
          <p style={{ color: '#6b7280', marginTop: 4, fontSize: 13 }}>
            Tournament starts Thu Mar 19 · Scores update as games complete
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['#', 'Bracket', 'Player', 'Score', 'Picks'].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 12px',
                    fontWeight: 600,
                    color: '#374151',
                    textAlign: i >= 3 ? 'right' : 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, i) => (
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
                <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{entry.score}</td>
                <td style={{ padding: '11px 12px', textAlign: 'right', color: '#9ca3af' }}>
                  {entry.picks_made}/63
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 32, textAlign: 'center' }}>
        Scoring: R64 ×2 · R32 ×3 · S16 ×5 · E8 ×8 · FF ×12 · Championship ×25
      </p>
    </div>
  )
}
