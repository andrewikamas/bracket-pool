'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import NCAABracket from '@/components/NCAABracket'

export default function EditBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bracketId } = React.use(params)
  const [bracket, setBracket] = useState<any>(null)
  const [initialPicks, setInitialPicks] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isLocked, setIsLocked] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/my-brackets'
        return
      }

      // Load bracket
      const { data: bracketData, error: bracketErr } = await supabase
        .from('brackets')
        .select('*, profiles(display_name)')
        .eq('id', bracketId)
        .single()

      if (bracketErr || !bracketData) {
        setError('Bracket not found.')
        setLoading(false)
        return
      }
      if (bracketData.user_id !== user.id) {
        setError("You don't have permission to edit this bracket.")
        setLoading(false)
        return
      }

      setBracket(bracketData)

      // Load existing picks
      const { data: picksData } = await supabase
        .from('picks')
        .select('game_id, winner_choice')
        .eq('bracket_id', bracketId)

      const picksMap: Record<string, number> = {}
      for (const p of picksData ?? []) {
        picksMap[p.game_id] = p.winner_choice
      }
      setInitialPicks(picksMap)

      // Check lock
      const { data: lockData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'lock_time')
        .single()
      if (lockData?.value) {
        setIsLocked(new Date() > new Date(lockData.value as string))
      }

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
          // Delete all current picks and re-insert the full current state.
          // This cleanly handles both additions and cascaded deletions.
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

          await supabase
            .from('brackets')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', bracketId)

          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
          setSaveStatus('error')
        }
      }, 900) // 900ms debounce — saves once user pauses
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
          await supabase
            .from('brackets')
            .update({ tiebreaker: value ? parseInt(value) : null, updated_at: new Date().toISOString() })
            .eq('id', bracketId)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
          setSaveStatus('error')
        }
      }, 900)
    },
    [bracketId, isLocked]
  )

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontFamily: 'system-ui' }}>
        Loading bracket...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui' }}>
        <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>
        <a href="/my-brackets" style={{ color: '#2563eb', fontSize: 14 }}>
          ← Back to my brackets
        </a>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '16px 20px' }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="/my-brackets"
            style={{ color: '#2563eb', fontSize: 13, textDecoration: 'none' }}
          >
            ← My Brackets
          </a>
          <span style={{ color: '#e5e7eb' }}>|</span>
          <span style={{ fontWeight: 500, fontSize: 15 }}>{bracket?.name}</span>
        </div>
        <span
          style={{
            fontSize: 12,
            color:
              saveStatus === 'error'
                ? '#dc2626'
                : saveStatus === 'saved'
                ? '#16a34a'
                : saveStatus === 'saving'
                ? '#9ca3af'
                : '#d1d5db',
          }}
        >
          {saveStatus === 'saving' && '⏳ Saving…'}
          {saveStatus === 'saved' && '✓ Saved'}
          {saveStatus === 'error' && '⚠ Save failed — check connection'}
          {isLocked && '🔒 Bracket locked'}
        </span>
      </div>

      {!loading && (
        <NCAABracket
          initialPicks={initialPicks}
          initialTiebreaker={bracket?.tiebreaker?.toString() ?? ''}
          onPicksChange={handlePicksChange}
          onTiebreakerChange={handleTiebreakerChange}
          locked={isLocked}
        />
      )}
    </div>
  )
}
