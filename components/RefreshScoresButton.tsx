'use client'
import { useState, useCallback } from 'react'

// All tournament dates — client fetches ESPN directly (bypasses Vercel IP blocks)
const TOURNAMENT_DATES = [
  '20260317', '20260318', // First Four
  '20260319', '20260320', // Round of 64
  '20260321', '20260322', // Round of 32
  '20260326', '20260327', // Sweet 16
  '20260328', '20260329', // Elite 8
  '20260404',             // Final Four
  '20260406',             // Championship
]

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'

interface RefreshResult {
  success?: boolean
  error?: string
  source?: string
  espnEventsFound?: number
  gamesMatched?: number
  gamesUpdated?: number
  errors?: number
  warnings?: string[]
  skipped?: string[]
  updateErrors?: string[]
  completedGames?: number
  hasInconsistencies?: boolean
  mode?: string
  message?: string
}

/** Fetch ESPN scoreboard for today ± 1 day, filtered to NCAA tournament. */
async function fetchESPNClientSide(): Promise<any[]> {
  // Figure out which dates to fetch: yesterday, today, tomorrow
  const today = new Date()
  const dates = [
    new Date(today.getTime() - 86_400_000),
    today,
    new Date(today.getTime() + 86_400_000),
  ].map(d => d.toISOString().slice(0, 10).replace(/-/g, ''))

  // Only fetch dates that are within the tournament window
  const validDates = dates.filter(d => TOURNAMENT_DATES.includes(d))
  if (validDates.length === 0) {
    // If no dates overlap with tournament, fetch today anyway to check
    validDates.push(dates[1])
  }

  const seen = new Set<string>()
  const allEvents: any[] = []

  for (const date of validDates) {
    try {
      const res = await fetch(`${ESPN_URL}?dates=${date}&groups=100&limit=50`)
      if (!res.ok) continue
      const data = await res.json()
      const events = (data.events ?? []).filter((e: any) =>
        e.tournamentId === 22 ||
        e.competitions?.[0]?.notes?.[0]?.headline?.includes("NCAA Men's Basketball Championship")
      )
      for (const e of events) {
        if (!seen.has(e.id)) {
          seen.add(e.id)
          allEvents.push(e)
        }
      }
    } catch (err) {
      console.warn(`ESPN fetch failed for ${date}:`, err)
    }
  }

  return allEvents
}

export default function RefreshScoresButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'warning' | 'error'>('idle')
  const [result, setResult] = useState<RefreshResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [step, setStep] = useState('')

  const refresh = useCallback(async () => {
    setStatus('loading')
    setResult(null)
    setShowDetails(false)

    try {
      // Step 1: Fetch ESPN client-side (from the user's browser — works everywhere)
      setStep('Fetching ESPN...')
      const events = await fetchESPNClientSide()

      if (events.length === 0) {
        setResult({
          success: true,
          espnEventsFound: 0,
          gamesUpdated: 0,
          message: 'No tournament games found on ESPN for today. This is normal between tournament rounds.',
        })
        setStatus('success')
        return
      }

      // Step 2: Send events to server for safe matching + DB writes
      setStep(`Processing ${events.length} games...`)
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      })

      const data: RefreshResult = await res.json()
      setResult(data)

      if (!res.ok || data.error) {
        setStatus('error')
      } else if (data.mode === 'manual') {
        setStatus('success')
      } else if (data.hasInconsistencies || (data.warnings && data.warnings.length > 0)) {
        setStatus('warning')
      } else {
        setStatus('success')
        // Auto-reload after 2s on clean success to show updated scores
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (err) {
      setResult({ error: `Failed: ${err}` })
      setStatus('error')
    }
  }, [])

  const statusColors = {
    idle: { bg: 'white', border: '#e5e7eb', text: '#374151' },
    loading: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  }

  const sc = statusColors[status]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={refresh}
        disabled={status === 'loading'}
        style={{
          padding: '9px 16px',
          background: sc.bg,
          color: sc.text,
          border: `1px solid ${sc.border}`,
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          cursor: status === 'loading' ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          transition: 'all 0.2s',
        }}
      >
        {status === 'loading' && `⏳ ${step}`}
        {status === 'idle' && '🔄 Refresh Scores'}
        {status === 'success' && '✅ Scores Updated'}
        {status === 'warning' && '⚠️ Updated with Warnings'}
        {status === 'error' && '❌ Refresh Failed'}
      </button>

      {/* Status banner — appears below the button */}
      {status !== 'idle' && status !== 'loading' && result && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: 8,
          width: 360,
          maxWidth: '90vw',
          background: sc.bg,
          border: `1px solid ${sc.border}`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: sc.text,
          zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {result.error && (
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {result.error}
            </div>
          )}

          {result.mode === 'manual' && (
            <div>{result.message}</div>
          )}

          {result.success && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {result.gamesUpdated ?? 0} games updated · {result.completedGames ?? 0} final
              </div>
              {result.espnEventsFound === 0 && result.message && (
                <div style={{ marginBottom: 4 }}>{result.message}</div>
              )}
              {(result.gamesUpdated ?? 0) > 0 && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Page will reload in 2 seconds...
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div
                onClick={() => setShowDetails(!showDetails)}
                style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12, marginBottom: 4 }}
              >
                {showDetails ? '▾' : '▸'} {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
              </div>
              {showDetails && (
                <div style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  fontSize: 11,
                  lineHeight: 1.5,
                  background: 'rgba(0,0,0,0.03)',
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                }}>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>{w}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => { setStatus('idle'); setResult(null) }}
            style={{
              marginTop: 8,
              fontSize: 11,
              color: sc.text,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.7,
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
