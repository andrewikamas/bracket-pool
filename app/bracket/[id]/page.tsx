import { createClient } from '@/lib/supabase/server'
import NCAABracket from '@/components/NCAABracket'

export default async function ViewBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: bracket }, { data: picksData }] = await Promise.all([
    supabase
      .from('brackets')
      .select('id, name, tiebreaker, profiles(display_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('picks')
      .select('game_id, winner_choice')
      .eq('bracket_id', id),
  ])

  if (!bracket) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: '#9ca3af' }}>
        Bracket not found.{' '}
        <a href="/" style={{ color: '#2563eb' }}>
          Back to leaderboard
        </a>
      </div>
    )
  }

  const picks: Record<string, number> = {}
  for (const p of picksData ?? []) {
    picks[p.game_id] = p.winner_choice
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '16px 20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <a href="/" style={{ color: '#2563eb', fontSize: 13, textDecoration: 'none' }}>
          ← Leaderboard
        </a>
        <span style={{ color: '#e5e7eb' }}>|</span>
        <span style={{ fontWeight: 500 }}>{bracket.name}</span>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>
          by {(bracket.profiles as any)?.display_name}
        </span>
      </div>

      <NCAABracket
        initialPicks={picks}
        initialTiebreaker={bracket.tiebreaker?.toString() ?? ''}
        locked={true}
      />
    </div>
  )
}
