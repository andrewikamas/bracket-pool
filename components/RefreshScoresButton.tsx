'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Confirmed ESPN IDs for Thursday R64 games
const ESPN_ID_MAP: Record<string, string> = {
  '401856478': 'E1', '401856479': 'E2', '401856480': 'W3', '401856481': 'W4',
  '401856482': 'E5', '401856483': 'E6', '401856484': 'W5', '401856485': 'W6',
  '401856486': 'M1', '401856487': 'M2', '401856488': 'S3', '401856489': 'S4',
  '401856490': 'S5', '401856491': 'S6', '401856492': 'S7', '401856493': 'S8',
}

// Team name hints for matching games without confirmed ESPN IDs
// Key = our game_id, value = unique team name(s) to identify the game
const GAME_HINTS: Record<string, string[]> = {
  // R64 Friday
  'S1': ['Florida'], 'S2': ['Clemson'], 'E3': ["St. John's"], 'E4': ['Kansas'],
  'E7': ['UCLA'], 'E8': ['UConn'], 'W1': ['Arizona'], 'W2': ['Villanova'],
  'W7': ['Miami'], 'W8': ['Purdue'], 'M3': ['Texas Tech'], 'M4': ['Alabama'],
  'M5': ['Tennessee'], 'M6': ['Virginia'], 'M7': ['Kentucky'], 'M8': ['Iowa State'],
  // R32 Saturday — use both team names for precise matching
  'MR1G0': ['Michigan', 'Saint Louis'],
  'ER1G2': ['Michigan State', 'Louisville'],
  'ER1G0': ['Duke', 'TCU'],
  'SR1G3': ['Houston', 'Texas A&M'],
  'WR1G3': ['Gonzaga', 'Texas'],
  'SR1G2': ['Illinois', 'VCU'],
  'SR1G1': ['Nebraska', 'Vanderbilt'],
  'WR1G1': ['Arkansas', 'High Point'],
}

export default function RefreshScoresButton() {
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [detail, setDetail] = useState('')
  const router = useRouter()

  const refresh = async () => {
    if (status === 'loading') return
    setStatus('loading')
    setDetail('')
    try {
      const scheduleUpdates: any[] = []
      const winnerUpdates: any[] = []

      // Fetch all three days: Thu R64, Fri R64, Sat R32
      for (const date of ['20260319', '20260320', '20260321']) {
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

          const competitors = comp.competitors
          const teamLocations = competitors.map((c: any) => c.team.location.toLowerCase())
          const teamNames = competitors.map((c: any) => c.team.displayName?.toLowerCase() ?? '')
          const statusDetail = event.status?.type?.detail ?? ''
          const timeMatch = statusDetail.match(/at (.+)$/)
          const tv = comp?.geoBroadcasts?.[0]?.media?.shortName ?? event.broadcast ?? null
          const venue = comp.venue ? `${comp.venue.fullName}, ${comp.venue.address.city}, ${comp.venue.address.state}` : null
          const gameTime = timeMatch ? timeMatch[1] : null
          const state = event.status?.type?.state

          // Resolve game_id: try ESPN ID map first, then hint matching
          let gameId: string | null = ESPN_ID_MAP[event.id] ?? null
          if (!gameId) {
            for (const [gid, hints] of Object.entries(GAME_HINTS)) {
              const allMatch = hints.every(hint =>
                teamLocations.some(l => l.includes(hint.toLowerCase()) || hint.toLowerCase().includes(l)) ||
                teamNames.some(n => n.includes(hint.toLowerCase()))
              )
              if (allMatch) { gameId = gid; break }
            }
          }
          if (!gameId) continue

          scheduleUpdates.push({ game_id: gameId, tv, game_time: gameTime, venue })

          if (state === 'post') {
            // Find winning competitor by score
            const winnerComp = competitors.reduce((a: any, b: any) =>
              parseInt(a.score) > parseInt(b.score) ? a : b
            )
            const home = competitors.find((c: any) => c.homeAway === 'home')
            const away = competitors.find((c: any) => c.homeAway === 'away')

            // Send winner's team name — server will resolve to 1 or 2
            // This works for ALL rounds (R64, R32, S16, etc.) generically
            winnerUpdates.push({
              game_id: gameId,
              winnerName: winnerComp.team.location,  // e.g. "Michigan", "Duke"
              score1: parseInt(home?.score ?? '0') || null,
              score2: parseInt(away?.score ?? '0') || null,
            })
          }
        }
      }

      if (scheduleUpdates.length > 0) {
        await fetch('/api/scores/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: scheduleUpdates }),
        })
      }

      if (winnerUpdates.length > 0) {
        await fetch('/api/scores/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: winnerUpdates, updateWinners: true }),
        })
      }

      setDetail(winnerUpdates.length > 0
        ? `${winnerUpdates.length} game${winnerUpdates.length > 1 ? 's' : ''} finished`
        : 'No new results yet')
      setStatus('done')
      router.refresh()
      setTimeout(() => { setStatus('idle'); setDetail('') }, 4000)
    } catch(e) {
      console.error('Refresh failed:', e)
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setDetail('') }, 3000)
    }
  }

  const label = { idle:'🔄 Refresh Scores', loading:'Checking ESPN...', done:`✓ ${detail||'Updated!'}`, error:'Failed — try again' }[status]
  const colors = {
    idle:   { bg:'white',   color:'#374151', border:'#e5e7eb' },
    loading:{ bg:'#f9fafb', color:'#9ca3af', border:'#e5e7eb' },
    done:   { bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
    error:  { bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
  }[status]

  return (
    <button onClick={refresh} disabled={status==='loading'} style={{
      padding:'9px 16px', background:colors.bg, color:colors.color,
      border:`1px solid ${colors.border}`, borderRadius:8, fontSize:14,
      fontWeight:500, cursor:status==='loading'?'not-allowed':'pointer',
      display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', transition:'all 0.2s',
    }}>
      {label}
    </button>
  )
}

  '401856478': 'E1', '401856479': 'E2', '401856480': 'W3', '401856481': 'W4',
  '401856482': 'E5', '401856483': 'E6', '401856484': 'W5', '401856485': 'W6',
  '401856486': 'M1', '401856487': 'M2', '401856488': 'S3', '401856489': 'S4',
  '401856490': 'S5', '401856491': 'S6', '401856492': 'S7', '401856493': 'S8',
}

const TEAM_MAP: Record<string, string[]> = {
  'S1': ['Florida'], 'S2': ['Clemson'], 'E3': ["St. John's"], 'E4': ['Kansas'],
  'E7': ['UCLA'], 'E8': ['UConn'], 'W1': ['Arizona'], 'W2': ['Villanova'],
  'W7': ['Miami'], 'W8': ['Purdue'], 'M3': ['Texas Tech'], 'M4': ['Alabama'],
  'M5': ['Tennessee'], 'M6': ['Virginia'], 'M7': ['Kentucky'], 'M8': ['Iowa State'],
}

const R64_TEAMS: Record<string, { team1: string; team2: string }> = {
  E1:{team1:'Duke',team2:'Siena'}, E2:{team1:'Ohio St.',team2:'TCU'},
  E5:{team1:'Louisville',team2:'South Florida'}, E6:{team1:'Michigan St.',team2:'N. Dakota St.'},
  E3:{team1:"St. John's",team2:'Northern Iowa'}, E4:{team1:'Kansas',team2:'Cal Baptist'},
  E7:{team1:'UCLA',team2:'UCF'}, E8:{team1:'UConn',team2:'Furman'},
  W3:{team1:'Wisconsin',team2:'High Point'}, W4:{team1:'Arkansas',team2:'Hawaii'},
  W5:{team1:'BYU',team2:'Texas/NC State'}, W6:{team1:'Gonzaga',team2:'Kennesaw St.'},
  W1:{team1:'Arizona',team2:'LIU'}, W2:{team1:'Villanova',team2:'Utah St.'},
  W7:{team1:'Miami (FL)',team2:'Missouri'}, W8:{team1:'Purdue',team2:'Queens'},
  M1:{team1:'Michigan',team2:'UMBC/Howard'}, M2:{team1:'Georgia',team2:'Saint Louis'},
  M3:{team1:'Texas Tech',team2:'Akron'}, M4:{team1:'Alabama',team2:'Hofstra'},
  M5:{team1:'Tennessee',team2:'SMU/Miami (OH)'}, M6:{team1:'Virginia',team2:'Wright St.'},
  M7:{team1:'Kentucky',team2:'Santa Clara'}, M8:{team1:'Iowa St.',team2:'Tennessee St.'},
  S1:{team1:'Florida',team2:'PV A&M/Lehigh'}, S2:{team1:'Clemson',team2:'Iowa'},
  S3:{team1:'Vanderbilt',team2:'McNeese'}, S4:{team1:'Nebraska',team2:'Troy'},
  S5:{team1:'North Carolina',team2:'VCU'}, S6:{team1:'Illinois',team2:'Penn'},
  S7:{team1:"Saint Mary's",team2:'Texas A&M'}, S8:{team1:'Houston',team2:'Idaho'},
}

export default function RefreshScoresButton() {
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [detail, setDetail] = useState('')
  const router = useRouter()

  const refresh = async () => {
    if (status === 'loading') return
    setStatus('loading')
    setDetail('')
    try {
      const scheduleUpdates: any[] = []
      const winnerUpdates: any[] = []

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
          const statusDetail = event.status?.type?.detail ?? ''
          const timeMatch = statusDetail.match(/at (.+)$/)
          const tv = comp?.geoBroadcasts?.[0]?.media?.shortName ?? event.broadcast ?? null
          const venue = comp.venue ? `${comp.venue.fullName}, ${comp.venue.address.city}, ${comp.venue.address.state}` : null
          const gameTime = timeMatch ? timeMatch[1] : null
          const state = event.status?.type?.state

          let gameId = ESPN_ID_MAP[event.id] ?? null
          if (!gameId) {
            for (const [gid, names] of Object.entries(TEAM_MAP)) {
              if (names.some(n => teamNames.some((t: string) => t.toLowerCase() === n.toLowerCase()))) {
                gameId = gid; break
              }
            }
          }
          if (!gameId) continue

          scheduleUpdates.push({ game_id: gameId, tv, game_time: gameTime, venue })

          if (state === 'post') {
            const competitors = comp.competitors
            const winnerComp = competitors.reduce((a: any, b: any) =>
              parseInt(a.score) > parseInt(b.score) ? a : b
            )
            const winnerLocation = winnerComp.team.location
            const teams = R64_TEAMS[gameId]
            if (teams) {
              const t1 = teams.team1.toLowerCase()
              const wl = winnerLocation.toLowerCase()
              const winnerChoice = (wl.includes(t1.split(' ')[0]) || t1.includes(wl.split(' ')[0])) ? 1 : 2
              const home = competitors.find((c: any) => c.homeAway === 'home')
              const away = competitors.find((c: any) => c.homeAway === 'away')
              winnerUpdates.push({
                game_id: gameId,
                winner: winnerChoice,
                score1: parseInt(home?.score ?? '0') || null,
                score2: parseInt(away?.score ?? '0') || null,
              })
            }
          }
        }
      }

      if (scheduleUpdates.length > 0) {
        await fetch('/api/scores/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: scheduleUpdates }),
        })
      }

      if (winnerUpdates.length > 0) {
        await fetch('/api/scores/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: winnerUpdates, updateWinners: true }),
        })
      }

      setDetail(winnerUpdates.length > 0
        ? `${winnerUpdates.length} game${winnerUpdates.length > 1 ? 's' : ''} finished`
        : 'No new results yet')
      setStatus('done')
      router.refresh()
      setTimeout(() => { setStatus('idle'); setDetail('') }, 4000)
    } catch(e) {
      console.error('Refresh failed:', e)
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setDetail('') }, 3000)
    }
  }

  const label = { idle:'🔄 Refresh Scores', loading:'Checking ESPN...', done:`✓ ${detail||'Updated!'}`, error:'Failed — try again' }[status]
  const colors = {
    idle:   { bg:'white',   color:'#374151', border:'#e5e7eb' },
    loading:{ bg:'#f9fafb', color:'#9ca3af', border:'#e5e7eb' },
    done:   { bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
    error:  { bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
  }[status]

  return (
    <button onClick={refresh} disabled={status==='loading'} style={{
      padding:'9px 16px', background:colors.bg, color:colors.color,
      border:`1px solid ${colors.border}`, borderRadius:8, fontSize:14,
      fontWeight:500, cursor:status==='loading'?'not-allowed':'pointer',
      display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', transition:'all 0.2s',
    }}>
      {label}
    </button>
  )
}
