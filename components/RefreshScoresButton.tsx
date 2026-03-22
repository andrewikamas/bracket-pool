'use client'
import { useState, useCallback } from 'react'

interface RefreshResult {
  success?: boolean
  error?: string
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

export default function RefreshScoresButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'warning' | 'error'>('idle')
  const [result, setResult] = useState<RefreshResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const refresh = useCallback(async () => {
    setStatus('loading')
    setResult(null)
    setShowDetails(false)

    try {
      const res = await fetch('/api/scores')
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
        // Auto-reload after 2s on clean success
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (err) {
      setResult({ error: `Network error: ${err}` })
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
        {status === 'loading' && '⏳ Refreshing...'}
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
          {/* Summary line */}
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
                {result.gamesUpdated} games updated · {result.completedGames} completed
              </div>
              {result.espnEventsFound === 0 && (
                <div style={{ color: '#b45309', marginBottom: 4 }}>
                  ESPN returned 0 events — server-side fetch may be blocked. Scores on the bracket pages use client-side ESPN and should still work.
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

          {/* Dismiss */}
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
