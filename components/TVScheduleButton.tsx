'use client'
import { useState } from 'react'

// All 32 R64 game definitions with region colors
const GAMES = [
  // Thursday March 19
  { id: 'E1',  t1: 'Duke',          s1: 1,  t2: 'Siena',           s2: 16, region: 'East',    espnId: '401856478' },
  { id: 'E2',  t1: 'Ohio St.',      s1: 8,  t2: 'TCU',             s2: 9,  region: 'East',    espnId: '401856479' },
  { id: 'W3',  t1: 'Wisconsin',     s1: 5,  t2: 'High Point',      s2: 12, region: 'West',    espnId: '401856480' },
  { id: 'W4',  t1: 'Arkansas',      s1: 4,  t2: 'Hawaii',          s2: 13, region: 'West',    espnId: '401856481' },
  { id: 'E5',  t1: 'Louisville',    s1: 6,  t2: 'South Florida',   s2: 11, region: 'East',    espnId: '401856482' },
  { id: 'E6',  t1: 'Michigan St.',  s1: 3,  t2: 'N. Dakota St.',   s2: 14, region: 'East',    espnId: '401856483' },
  { id: 'W5',  t1: 'BYU',          s1: 6,  t2: 'Texas/NC State',  s2: 11, region: 'West',    espnId: '401856484' },
  { id: 'W6',  t1: 'Gonzaga',       s1: 3,  t2: 'Kennesaw St.',    s2: 14, region: 'West',    espnId: '401856485' },
  { id: 'M1',  t1: 'Michigan',      s1: 1,  t2: 'UMBC/Howard',     s2: 16, region: 'Midwest', espnId: '401856486' },
  { id: 'M2',  t1: 'Georgia',       s1: 8,  t2: 'Saint Louis',     s2: 9,  region: 'Midwest', espnId: '401856487' },
  { id: 'S3',  t1: 'Vanderbilt',    s1: 5,  t2: 'McNeese',         s2: 12, region: 'South',   espnId: '401856488' },
  { id: 'S4',  t1: 'Nebraska',      s1: 4,  t2: 'Troy',            s2: 13, region: 'South',   espnId: '401856489' },
  { id: 'S5',  t1: 'North Carolina',s1: 6,  t2: 'VCU',             s2: 11, region: 'South',   espnId: '401856490' },
  { id: 'S6',  t1: 'Illinois',      s1: 3,  t2: 'Penn',            s2: 14, region: 'South',   espnId: '401856491' },
  { id: 'S7',  t1: "Saint Mary's",  s1: 7,  t2: 'Texas A&M',       s2: 10, region: 'South',   espnId: '401856492' },
  { id: 'S8',  t1: 'Houston',       s1: 2,  t2: 'Idaho',           s2: 15, region: 'South',   espnId: '401856493' },
  // Friday March 20 — ESPN IDs unconfirmed, will populate when schedule releases
  { id: 'W1',  t1: 'Arizona',       s1: 1,  t2: 'LIU',             s2: 16, region: 'West',    espnId: '' },
  { id: 'W2',  t1: 'Villanova',     s1: 8,  t2: 'Utah St.',        s2: 9,  region: 'West',    espnId: '' },
  { id: 'S1',  t1: 'Florida',       s1: 1,  t2: 'PV A&M/Lehigh',  s2: 16, region: 'South',   espnId: '' },
  { id: 'S2',  t1: 'Clemson',       s1: 8,  t2: 'Iowa',            s2: 9,  region: 'South',   espnId: '' },
  { id: 'E3',  t1: "St. John's",    s1: 5,  t2: 'Northern Iowa',   s2: 12, region: 'East',    espnId: '' },
  { id: 'E4',  t1: 'Kansas',        s1: 4,  t2: 'Cal Baptist',     s2: 13, region: 'East',    espnId: '' },
  { id: 'W7',  t1: 'Miami (FL)',    s1: 7,  t2: 'Missouri',        s2: 10, region: 'West',    espnId: '' },
  { id: 'W8',  t1: 'Purdue',        s1: 2,  t2: 'Queens',          s2: 15, region: 'West',    espnId: '' },
  { id: 'M3',  t1: 'Texas Tech',    s1: 5,  t2: 'Akron',           s2: 12, region: 'Midwest', espnId: '' },
  { id: 'M4',  t1: 'Alabama',       s1: 4,  t2: 'Hofstra',         s2: 13, region: 'Midwest', espnId: '' },
  { id: 'E7',  t1: 'UCLA',          s1: 7,  t2: 'UCF',             s2: 10, region: 'East',    espnId: '' },
  { id: 'E8',  t1: 'UConn',         s1: 2,  t2: 'Furman',          s2: 15, region: 'East',    espnId: '' },
  { id: 'M5',  t1: 'Tennessee',     s1: 6,  t2: 'SMU/Miami (OH)', s2: 11, region: 'Midwest', espnId: '' },
  { id: 'M6',  t1: 'Virginia',      s1: 3,  t2: 'Wright St.',      s2: 14, region: 'Midwest', espnId: '' },
  { id: 'M7',  t1: 'Kentucky',      s1: 7,  t2: 'Santa Clara',     s2: 10, region: 'Midwest', espnId: '' },
  { id: 'M8',  t1: 'Iowa St.',      s1: 2,  t2: 'Tennessee St.',   s2: 15, region: 'Midwest', espnId: '' },
]

const REGION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  South:   { bg: '#E1F5EE', text: '#085041', border: '#0F6E56' },
  East:    { bg: '#E6F1FB', text: '#0C447C', border: '#185FA5' },
  West:    { bg: '#FAECE7', text: '#712B13', border: '#993C1D' },
  Midwest: { bg: '#EEEDFE', text: '#3C3489', border: '#534AB7' },
}

const TV_COLORS: Record<string, string> = {
  CBS:   '#0033a0',
  TBS:   '#00828f',
  TNT:   '#e8242a',
  truTV: '#6b21a8',
}

interface GameSchedule {
  tv: string | null
  game_time: string | null
  venue: string | null
  status?: string
  score1?: number | null
  score2?: number | null
}

export default function TVScheduleButton() {
  const [open, setOpen] = useState(false)
  const [schedule, setSchedule] = useState<Record<string, GameSchedule>>({})
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchSchedule = async () => {
    if (fetched) return
    setLoading(true)
    try {
      const espnIdToGameId: Record<string, string> = {}
      for (const g of GAMES) espnIdToGameId[g.espnId] = g.id

      const results: Record<string, GameSchedule> = {}
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
          const gameId = espnIdToGameId[event.id]
          if (!gameId) continue
          const comp = event.competitions?.[0]
          const detail = event.status?.type?.detail ?? ''
          const timeMatch = detail.match(/at (.+)$/)
          const competitors = comp?.competitors ?? []
          const home = competitors.find((c: any) => c.homeAway === 'home')
          const away = competitors.find((c: any) => c.homeAway === 'away')
          results[gameId] = {
            tv: comp?.geoBroadcasts?.[0]?.media?.shortName ?? event.broadcast ?? null,
            game_time: timeMatch ? timeMatch[1] : null,
            venue: comp?.venue ? `${comp.venue.fullName}, ${comp.venue.address.city}, ${comp.venue.address.state}` : null,
            status: event.status?.type?.state,
            score1: home ? parseInt(home.score) || null : null,
            score2: away ? parseInt(away.score) || null : null,
          }
        }
      }
      setSchedule(results)
      setFetched(true)
    } catch (e) {
      console.warn('Schedule fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    fetchSchedule()
  }

  // Group games by date then by time slot
  const thu = GAMES.slice(0, 16)
  const fri = GAMES.slice(16)

  const DaySection = ({ games, day }: { games: typeof GAMES; day: string }) => {
    // Parse "2:30 PM ET" style strings into sortable minutes-since-midnight
    const parseTime = (t: string): number => {
      const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
      if (!m) return 9999
      let h = parseInt(m[1])
      const min = parseInt(m[2])
      const ampm = m[3].toUpperCase()
      if (ampm === 'PM' && h !== 12) h += 12
      if (ampm === 'AM' && h === 12) h = 0
      return h * 60 + min
    }

    const sorted = [...games].sort((a, b) => {
      const ta = schedule[a.id]?.game_time ?? ''
      const tb = schedule[b.id]?.game_time ?? ''
      if (!ta && !tb) return 0
      if (!ta) return 1
      if (!tb) return -1
      return parseTime(ta) - parseTime(tb)
    })

    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: '#9ca3af',
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid #f3f4f6',
        }}>
          {day}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map(game => {
            const sched = schedule[game.id]
            const rc = REGION_COLORS[game.region]
            const tvColor = TV_COLORS[sched?.tv ?? ''] ?? '#6b7280'
            const isLive = sched?.status === 'in'
            const isFinal = sched?.status === 'post'

            return (
              <div key={game.id} style={{
                display: 'grid',
                gridTemplateColumns: '64px 1fr auto',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#fafafa',
                border: '1px solid #f3f4f6',
                transition: 'border-color 0.15s',
              }}>
                {/* Time + TV */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isLive ? '#ef4444' : '#374151',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}>
                    {isLive ? '🔴 LIVE' : sched?.game_time ?? 'TBD'}
                  </div>
                  {sched?.tv && (
                    <div style={{
                      marginTop: 3,
                      display: 'inline-block',
                      background: tvColor,
                      color: 'white',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      padding: '2px 5px',
                      borderRadius: 3,
                    }}>
                      {sched.tv}
                    </div>
                  )}
                </div>

                {/* Teams + venue */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{
                      display: 'inline-block',
                      background: rc.bg,
                      color: rc.text,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      letterSpacing: 0.3,
                    }}>
                      {game.region.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: isFinal && (sched?.score1 ?? 0) > (sched?.score2 ?? 0) ? 600 : 400 }}>
                      <span style={{ color: '#9ca3af', fontSize: 11, marginRight: 4 }}>{game.s1}</span>
                      {game.t1}
                    </span>
                    {isFinal && sched?.score1 != null && (
                      <span style={{ float: 'right', fontWeight: 700, fontSize: 13, color: '#111' }}>{sched.score1}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: '#6b7280' }}>
                    <span style={{ fontWeight: isFinal && (sched?.score2 ?? 0) > (sched?.score1 ?? 0) ? 600 : 400, color: isFinal && (sched?.score2 ?? 0) > (sched?.score1 ?? 0) ? '#111' : '#6b7280' }}>
                      <span style={{ color: '#d1d5db', fontSize: 11, marginRight: 4 }}>{game.s2}</span>
                      {game.t2}
                    </span>
                    {isFinal && sched?.score2 != null && (
                      <span style={{ float: 'right', fontWeight: 700, fontSize: 13, color: isFinal && (sched?.score2 ?? 0) > (sched?.score1 ?? 0) ? '#111' : '#6b7280' }}>{sched.score2}</span>
                    )}
                  </div>
                  {sched?.venue && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{sched.venue}</div>
                  )}
                </div>

                {/* Status badge */}
                <div style={{ textAlign: 'right', minWidth: 48 }}>
                  {isFinal && (
                    <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>FINAL</span>
                  )}
                  {isLive && (
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>LIVE</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={handleOpen}
        style={{
          padding: '9px 16px',
          background: 'white',
          color: '#374151',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        📺 TV Schedule
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '40px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 12,
              width: '100%',
              maxWidth: 520,
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #f3f4f6',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 1,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>📺 First Round TV Schedule</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Mar 19–20 · All times EDT</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 20px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
                  Loading schedule...
                </div>
              ) : (
                <>
                  <DaySection games={thu} day="Thursday, March 19" />
                  <DaySection games={fri} day="Friday, March 20" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
