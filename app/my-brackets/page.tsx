'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MyBracketsPage() {
  const [user, setUser] = useState<any>(null)
  const [brackets, setBrackets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        await Promise.all([loadBrackets(user.id), checkLock()])
      }
      setLoading(false)
    }
    init()
  }, [])

  const checkLock = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'lock_time')
      .single()
    if (data?.value) {
      setIsLocked(new Date() > new Date(data.value as string))
    }
  }

  const loadBrackets = async (userId: string) => {
    const { data } = await supabase
      .from('brackets')
      .select('id, name, updated_at')
      .eq('user_id', userId)
      .order('created_at')
    setBrackets(data ?? [])
  }

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/my-brackets` },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setBrackets([])
  }

  const createBracket = async () => {
    if (!newName.trim() || !user || creating) return
    setCreating(true)
    const { data, error } = await supabase
      .from('brackets')
      .insert({ user_id: user.id, name: newName.trim() })
      .select()
      .single()
    if (data && !error) {
      window.location.href = `/bracket/${data.id}/edit`
    }
    setCreating(false)
  }

  const deleteBracket = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return
    await supabase.from('brackets').delete().eq('id', id)
    setBrackets((prev) => prev.filter((b) => b.id !== id))
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontFamily: 'system-ui' }}>
        Loading...
      </div>
    )
  }

  // ── Not signed in ──────────────────────────────────────────
  if (!user) {
    return (
      <div
        style={{
          fontFamily: 'system-ui',
          maxWidth: 440,
          margin: '80px auto',
          padding: '0 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 16 }}>🏀</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>2026 NCAA Bracket Pool</h1>
        <p style={{ color: '#6b7280', marginBottom: 28, fontSize: 14, lineHeight: 1.5 }}>
          Sign in to fill out your bracket and join the family pool.
        </p>
        <button
          onClick={signIn}
          style={{
            padding: '12px 28px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
            maxWidth: 280,
          }}
        >
          Sign in with Google
        </button>
        <div style={{ marginTop: 20 }}>
          <a href="/" style={{ color: '#2563eb', fontSize: 13 }}>
            View leaderboard →
          </a>
        </div>
      </div>
    )
  }

  // ── Signed in ──────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 620, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>My Brackets</h1>
          <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 3 }}>{user.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="/" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
            Leaderboard
          </a>
          <button
            onClick={signOut}
            style={{
              padding: '6px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              background: 'white',
              cursor: 'pointer',
              fontSize: 13,
              color: '#374151',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Lock banner */}
      {isLocked && (
        <div
          style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#92400e',
          }}
        >
          🔒 Brackets are locked — the tournament has started. You can still view your brackets.
        </div>
      )}

      {/* Existing brackets */}
      {brackets.map((b) => (
        <div
          key={b.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            marginBottom: 8,
            background: 'white',
          }}
        >
          <div>
            <div style={{ fontWeight: 500, fontSize: 15 }}>{b.name}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              Saved {new Date(b.updated_at).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!isLocked && (
              <a
                href={`/bracket/${b.id}/edit`}
                style={{
                  padding: '6px 14px',
                  background: '#2563eb',
                  color: 'white',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Edit
              </a>
            )}
            <a
              href={`/bracket/${b.id}`}
              style={{
                padding: '6px 14px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
                color: '#374151',
              }}
            >
              View
            </a>
            {!isLocked && (
              <button
                onClick={() => deleteBracket(b.id, b.name)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #fca5a5',
                  background: 'white',
                  borderRadius: 6,
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Create new bracket */}
      {!isLocked && brackets.length < 10 && (
        <div
          style={{
            marginTop: brackets.length > 0 ? 12 : 0,
            background: '#f9fafb',
            borderRadius: 10,
            padding: 16,
            border: '1px dashed #d1d5db',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#374151' }}>
            {brackets.length === 0 ? 'Create your first bracket' : 'Add another bracket'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createBracket()}
              placeholder="e.g. Dad's Bracket or Timmy's Picks"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                outline: 'none',
                background: 'white',
              }}
            />
            <button
              onClick={createBracket}
              disabled={!newName.trim() || creating}
              style={{
                padding: '8px 18px',
                background: newName.trim() ? '#2563eb' : '#bfdbfe',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: newName.trim() ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {creating ? 'Creating...' : 'Create →'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, marginBottom: 0 }}>
            Create one per family member — e.g. "Dad's Bracket", "Timmy's Picks"
          </p>
        </div>
      )}

      {brackets.length === 0 && !loading && (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 12 }}>
          Create a bracket above to get started!
        </p>
      )}
    </div>
  )
}
