'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import NCAABracket from '@/components/NCAABracket'

export default function EditBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bracketId } = React.use(params)
  const [bracket, setBracket] = useState<any>(null)
  const [initialPicks, setInitialPicks] = useState<Record<string, number>>({})
  const [gameSchedule, setGameSchedule] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isLocked, setIsLocked] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/my-brackets'; return }

      const [
        { data: bracketData, error: bracketErr },
        { data: picksData },
        { data: lockData },
        { data: scheduleData },
      ] = await Promise.all([
        supabase.from('brackets').select('*, profiles(display_name)').eq('id', bracketId).single(),
        supabase.from('picks').select('game_id, winner_choice').eq('bracket_id', bracketId),
        supabase.from('app_settings').select('value').eq('key', 'lock_time').single(),
        supabase.from('tournament_games').select('game_id, tv, game_time, venue').eq('round', 0),
      ])

      if (bracketErr || !bracketData) { setError('Bracket not found.'); setLoading(false); return }
      if (bracketData.user_id !== user.id) { setError("You don't have permission to edit this bracket."); setLoading(false); return }

      setBracket(bracketData)

      // Picks
      const picksMap: Record<string, number> = {}
      for (const p of picksData ?? []) picksMap[p.game_id] = p.winner_choice
      setInitialPicks(picksMap)

      // Lock
      if (lockData?.value) setIsLocked(new Date() > new Date(lockData.value as string))

      // Game schedule from ESPN sync
      const schedMap: Record<string, any> = {}
      for (const g of scheduleData ?? []) {
        if (g.game_id) schedMap[g.game_id] = { tv: g.tv, game_time: g.game_time, venue: g.venue }
      }
      setGameSchedule(schedMap)

      setLoading(false)
    }
    init()
  }, [bracketId])

  const handlePicksChange = useCallback(
    (newPicks: Record<string, number>) => {
      if (isLocked) return
      setSaveStatus('saving')
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await supabase.from('picks').delete().eq('bracket_id', bracketId)
          const picksArray = Object.entries(newPicks).map(([game_id, winner_choice]) => ({
            bracket_id: bracketId,
            game_id,
            winner_choice,
          }))
          if (picksArray.length > 0) {
            const { error } = await supabase.from('picks').insert(picksArray)
            if (error) throw error
          }
          await supabase.from('brackets').update({ updated_at: new Date().toISOString() }).eq('id', bracketId)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
          setSaveStatus('error')
        }
      }, 900)
    },
    [bracketId, isLocked]
  )

  const handleTiebreakerChange = useCallback(
    (value: string) => {
      if (isLocked) return
      clearTimeout(saveTimer.current)
      setSaveStatus('saving')
      saveTimer.current = setTimeout(async () => {
        try {
          await supabase.from('brackets').update({ tiebreaker: value ? parseInt(value) : null }).eq('id', bracketId)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
          setSaveStatus('error')
        }
      }, 900)
    },
    [bracketId, isLocked]
  )

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: '#9ca3af' }}>
      Loading your bracket...
    </div>
  )

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: '#9ca3af' }}>
      {error} <a href="/my-brackets" style={{ color: '#2563eb' }}>← My Brackets</a>
    </div>
  )

  return (
    <div style={{ fontFamily: 'system-ui', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <a href="/my-brackets" style={{ color: '#2563eb', fontSize: 13, textDecoration: 'none' }}>← My Brackets</a>
        <span style={{ color: '#e5e7eb' }}>|</span>
        <span style={{ fontWeight: 500 }}>{bracket?.name}</span>
        {isLocked && (
          <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, border: '1px solid #f59e0b' }}>
            🔒 Locked
          </span>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: 12, color:
            saveStatus === 'saved' ? '#10b981' :
            saveStatus === 'saving' ? '#9ca3af' :
            saveStatus === 'error' ? '#ef4444' : 'transparent'
        }}>
          {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Save failed' : '·'}
        </span>
      </div>

      {isLocked && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
          🔒 The bracket is locked — no more changes allowed.
        </div>
      )}

      <NCAABracket
        initialPicks={initialPicks}
        initialTiebreaker={bracket?.tiebreaker?.toString() ?? ''}
        locked={isLocked}
        gameSchedule={gameSchedule}
        onPicksChange={handlePicksChange}
        onTiebreakerChange={handleTiebreakerChange}
      />
    </div>
  )
}
