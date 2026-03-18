'use client'
import { useState, useEffect, useCallback } from 'react'

interface LeaderboardEntry {
  bracket_id: string
  bracket_name: string
  display_name: string
  score: number
  picks_made: number
}

interface Commentary {
  family: string
  spicy: string
  generated_at: string
}

export default function AICommentary({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  const [commentary, setCommentary] = useState<Commentary | null>(null)
  const [tone, setTone] = useState<'family' | 'spicy'>('family')
  const [status, setStatus] = useState<'loading' | 'generating' | 'ready' | 'error'>('loading')

  const generate = useCallback(async () => {
    setStatus('generating')
    try {
      const res = await fetch('/api/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderboard }),
      })
      const data = await res.json()
      if (data.commentary) {
        setCommentary(data.commentary)
        setStatus('ready')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }, [leaderboard])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/commentary')
        const data = await res.json()
        if (data.commentary) {
          setCommentary(data.commentary)
          setStatus('ready')
        } else {
          // No cache — generate fresh on first load
          await generate()
        }
      } catch {
        setStatus('error')
      }
    }
    load()
  }, [generate])

  const isSpicy = tone === 'spicy'

  // Colors shift between warm amber (family) and fiery orange-red (spicy)
  const colors = isSpicy
    ? { bg: '#fff7f0', border: '#fed7aa', accent: '#ea580c', label: '#9a3412', text: '#431407', muted: '#c2410c' }
    : { bg: '#fefce8', border: '#fde68a', accent: '#d97706', label: '#92400e', text: '#1c1917', muted: '#a16207' }

  if (status === 'loading') {
    return (
      <div style={{
        marginBottom: 24,
        padding: '14px 16px',
        background: '#f9fafb',
        borderRadius: 12,
        border: '1px solid #f3f4f6',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: '#9ca3af',
        fontSize: 13,
      }}>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
        Loading commentary…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (status === 'generating') {
    return (
      <div style={{
        marginBottom: 24,
        padding: '14px 16px',
        background: '#fefce8',
        borderRadius: 12,
        border: '1px solid #fde68a',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: '#92400e',
        fontSize: 13,
        fontWeight: 500,
      }}>
        <span>✨</span>
        Generating pool report…
      </div>
    )
  }

  if (status === 'error' || !commentary) {
    return (
      <div style={{
        marginBottom: 24,
        padding: '14px 16px',
        background: '#fef2f2',
        borderRadius: 12,
        border: '1px solid #fecaca',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{ fontSize: 13, color: '#991b1b' }}>Couldn't load commentary.</span>
        <button
          onClick={generate}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#991b1b',
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  const timeAgo = (() => {
    const diff = Date.now() - new Date(commentary.generated_at).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  })()

  return (
    <div style={{
      marginBottom: 24,
      padding: '14px 16px',
      background: colors.bg,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      transition: 'background 0.3s ease, border-color 0.3s ease',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: colors.label,
        }}>
          🎙️ Pool Report
        </span>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Tone toggle */}
          <button
            onClick={() => setTone(isSpicy ? 'family' : 'spicy')}
            title={isSpicy ? 'Switch to family-friendly' : 'Switch to spicy mode'}
            style={{
              fontSize: 12,
              padding: '4px 10px',
              background: isSpicy ? '#fff7ed' : '#fef9c3',
              border: `1px solid ${isSpicy ? '#fed7aa' : '#fde68a'}`,
              borderRadius: 20,
              cursor: 'pointer',
              color: colors.muted,
              fontWeight: 600,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {isSpicy ? '😇 Keep it clean' : '🌶️ Spice it up'}
          </button>

          {/* Refresh */}
          <button
            onClick={generate}
            title="Generate fresh commentary"
            style={{
              fontSize: 12,
              padding: '4px 10px',
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: 20,
              cursor: 'pointer',
              color: colors.muted,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            ✨ Refresh
          </button>
        </div>
      </div>

      {/* Commentary text */}
      <p style={{
        margin: 0,
        fontSize: 14,
        lineHeight: 1.65,
        color: colors.text,
        transition: 'color 0.3s ease',
      }}>
        {commentary[tone]}
      </p>

      {/* Footer */}
      <p style={{
        fontSize: 10,
        color: colors.muted,
        marginTop: 8,
        marginBottom: 0,
        textAlign: 'right',
        opacity: 0.7,
      }}>
        Generated {timeAgo} · AI-powered · costs tokens to refresh
      </p>
    </div>
  )
}
