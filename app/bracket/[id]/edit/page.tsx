'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import NCAABracket from '@/components/NCAABracket'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Bracket = NCAABracket as any

export default function EditBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bracketId } = React.use(params)
  const [bracket, setBracket] = useState<any>(null)
  const [initialPicks, setInitialPicks] = useState<Record<string, number>>({})
  const [gameSchedule, setGameSchedule] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isLocked, setIsLocked] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
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

      const picksMap: Record<string, number> = {}
      for (const p of picksData ?? []) picksMap[p.game_id] = p.winner_choice
      setInitialPicks(picksMap)

      if (lockData?.value) setIsLocked(new Date() > new Date(lockData.value as string))

      const schedMap: Record<string, any> = {}
      for (const g of scheduleData ?? []) {
        if (g.game_id) schedMap[g.game_id] = { tv: g.tv, game_time: g.game_time, venue: g.venue }
      }
      setGameSchedule(schedMap)

      setLoading(false)

      fetchESPNClientSide(schedMap)
    }

    const fetchESPNClientSide = async (existing: Record<string, any>) => {
      const ESPN_ID_MAP: Record<string, string> = {
        '401856478': 'E1', '401856479': 'E2', '401856480': 'W3', '401856481': 'W4',
        '401856482': 'E5', '401856483': 'E6', '401856484': 'W5', '401856485': 'W6',
        '401856486': 'M1', '401856487': 'M2', '401856488': 'S3', '401856489': 'S4',
        '401856490': 'S5', '401856491': 'S6', '401856492': 'S7', '401856493': 'S8',
      }

      const TEAM_MAP: Record<string, string[]> = {
        'S1': ['Florida'],       'S2': ['Clemson'],
        'E3': ["St. John's"],    'E4': ['Kansas'],
        'E7': ['UCLA'],          'E8': ['UConn'],
        'W1': ['Arizona'],       'W2': ['Villanova'],
        'W7': ['Miami'],         'W8': ['Purdue'],
        'M3': ['Texas Tech'],    'M4': ['Alabama'],
        'M5': ['Tennessee'],     'M6': ['Virginia'],
        'M7': ['Kentucky'],      'M8': ['Iowa State'],
      }

      try {
        const merged = { ...existing }
        for (const date of ['20260319', '20260320']) {
          const res = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=100&limit=50`
          )
          if (!res.ok) continue
          const data = await res.json()
          const events = (data.events ?? []).filter((e: any) =>
            e.tournamentId === 22 ||
            e.competitions?.[0]?.notes?.[0]?.headline?.includes("NCAA Men's Basketball Championship")
          )
          for (const event of events) {
            const comp = event.competitions?.[0]
            if (!comp) continue
            const teamNames = comp.competitors.map((c: any) => c.team.location as string)
            const detail = event.status?.type?.detail ?? ''
            const timeMatch = detail.match(/at (.+)$/)
            const gameTime = timeMatch ? timeMatch[1] : 'TBD'
            const tv = comp?.geoBroadcasts?.[0]?.media?.shortName ?? event.broadcast ?? 'TBD'
            const venue = comp.venue ? `${comp.venue.fullName}, ${comp.venue.address.city}, ${comp.venue.address.state}` : 'TBD'

            const gameIdFromId = ESPN_ID_MAP[event.id]
            if (gameIdFromId) {
              merged[gameIdFromId] = { tv, game_time: gameTime, venue }
              continue
            }

            for (const [gameId, nameOptions] of Object.entries(TEAM_MAP)) {
              if (merged[gameId]?.tv) continue
              const matched = nameOptions.some(name =>
                teamNames.some((t: string) => t.toLowerCase() === name.toLowerCase())
              )
              if (matched) {
                merged[gameId] = { tv, game_time: gameTime, venue }
                break
              }
            }
          }
        }
        setGameSchedule(merged)
        const updates = Object.entries(merged).map(([game_id, info]) => ({
          game_id, tv: info.tv, game_time: info.game_time, venue: info.venue
        }))
        await fetch('/api/scores/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        }).catch(() => {})
      } catch (e) {
        console.warn('ESPN client fetch failed:', e)
      }
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
          // Upsert all current picks — no bulk delete, eliminates race condition
          const picksArray = Object.entries(newPicks).map(([game_id, winner_choice]) => ({
            bracket_id: bracketId,
            game_id,
            winner_choice,
          }))
          if (picksArray.length > 0) {
            const { error } = await supabase
              .from('picks')
              .upsert(picksArray, { onConflict: 'bracket_id,game_id' })
            if (error) throw error
          }
          // Delete only picks that were explicitly removed
          const currentGameIds = Object.keys(newPicks)
          const { data: existingPicks } = await supabase
            .from('picks')
            .select('game_id')
            .eq('bracket_id', bracketId)
          const toDelete = (existingPicks ?? [])
            .map((p: any) => p.game_id)
            .filter((id: string) => !currentGameIds.includes(id))
          if (toDelete.length > 0) {
            await supabase.from('picks').delete()
              .eq('bracket_id', bracketId)
              .in('game_id', toDelete)
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

      <Bracket
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
