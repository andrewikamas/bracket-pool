import { createClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NCAABracket = require('@/components/NCAABracket').default as any

export default async function ViewBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: bracket }, { data: picksData }, { data: lockSetting }, { data: authUser }] = await Promise.all([
    supabase.from('brackets').select('id, name, tiebreaker, user_id, profiles(display_name)').eq('id', id).single(),
    supabase.from('picks').select('game_id, winner_choice').eq('bracket_id', id),
    supabase.from('app_settings').select('value').eq('key', 'lock_time').single(),
    supabase.auth.getUser(),
  ])

  if (!bracket) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: '#9ca3af' }}>
        Bracket not found.{' '}
        <a href="/" style={{ color: '#2563eb' }}>Back to leaderboard</a>
      </div>
    )
  }

  const lockTime = lockSetting?.value ? new Date(lockSetting.value as string) : null
  const isLocked = lockTime ? new Date() > lockTime : false
  const isOwner = authUser?.data?.user?.id === bracket.user_id

  // Hide picks until lock time — unless you're the owner (use edit page for that)
  const picks: Record<string, number> = {}
  if (isLocked) {
    for (const p of picksData ?? []) {
      picks[p.game_id] = p.winner_choice
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <a href="/" style={{ color: '#2563eb', fontSize: 13, textDecoration: 'none' }}>← Leaderboard</a>
        <span style={{ color: '#e5e7eb' }}>|</span>
        <span style={{ fontWeight: 500 }}>{bracket.name}</span>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>by {(bracket.profiles as any)?.display_name}</span>
        {isOwner && !isLocked && (
          <a
            href={`/bracket/${id}/edit`}
            style={{ marginLeft: 'auto', color: '#2563eb', fontSize: 13, textDecoration: 'none' }}
          >
            Edit your picks →
          </a>
        )}
      </div>

      {!isLocked && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 14,
          color: '#92400e',
        }}>
          🔒 Picks are hidden until the tournament starts on Thu Mar 19.
          {isOwner && <span> <a href={`/bracket/${id}/edit`} style={{ color: '#92400e', fontWeight: 600 }}>Edit your picks →</a></span>}
        </div>
      )}

      <NCAABracket
        initialPicks={picks}
        initialTiebreaker={isLocked ? bracket.tiebreaker?.toString() ?? '' : ''}
        locked={true}
      />
    </div>
  )
}
