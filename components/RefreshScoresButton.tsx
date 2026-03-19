'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RefreshScoresButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const router = useRouter()

  const refresh = async () => {
    if (status === 'loading') return
    setStatus('loading')
    try {
      const res = await fetch('/api/scores')
      if (!res.ok) throw new Error('fetch failed')
      setStatus('done')
      // Re-render the server component with fresh Supabase data
      router.refresh()
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const label = {
    idle:    '🔄 Refresh Scores',
    loading: 'Updating...',
    done:    '✓ Updated!',
    error:   'Failed — try again',
  }[status]

  const bg = {
    idle:    'white',
    loading: '#f9fafb',
    done:    '#f0fdf4',
    error:   '#fef2f2',
  }[status]

  const color = {
    idle:    '#374151',
    loading: '#9ca3af',
    done:    '#15803d',
    error:   '#dc2626',
  }[status]

  const border = {
    idle:    '#e5e7eb',
    loading: '#e5e7eb',
    done:    '#bbf7d0',
    error:   '#fecaca',
  }[status]

  return (
    <button
      onClick={refresh}
      disabled={status === 'loading'}
      style={{
        padding: '9px 16px',
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  )
}
