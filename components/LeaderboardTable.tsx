'use client'
import { useState, Fragment } from 'react'
import ChampionBadge from '@/components/ChampionBadge'

interface RoundBreakdown {
  correct: number
  wrong: number
  points: number
}

interface LeaderboardEntry {
  bracket_id: string
  bracket_name: string
  display_name: string
  score: number
  max_possible: number
  picks_made: number
  tiebreaker: number | null
  champion_pick: string | null
  breakdown: RoundBreakdown[]
}

const ROUND_LABELS = ['R64', 'R32', 'S16', 'E8', 'FF', 'Champ']
const ROUND_MULTIPLIERS = [2, 3, 5, 8, 12, 25]
const GAMES_PER_ROUND = [32, 16, 8, 4, 2, 1]

export default function LeaderboardTable({
  leaderboard,
  completedPerRound,
}: {
  leaderboard: LeaderboardEntry[]
  completedPerRound: Record<number, number>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const hasChampPicks = leaderboard.some((e) => e.champion_pick)
  const anyScored = leaderboard.some((e) => e.score > 0)
  const colCount = 3 + (hasChampPicks ? 1 : 0) + 1 + (anyScored ? 1 : 0)

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
          {[
            '#',
            'Bracket',
            'Player',
            hasChampPicks ? '🏆 Pick' : null,
            'Score',
            anyScored ? 'Max' : null,
          ]
            .filter(Boolean)
            .map((h, i, arr) => (
              <th
                key={h as string}
                style={{
                  padding: '8px 12px',
                  fontWeight: 600,
                  color: '#374151',
                  textAlign: i >= arr.length - 2 ? 'right' : 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
        </tr>
      </thead>
      <tbody>
        {leaderboard.map((entry, i) => {
          const rank =
            i === 0
              ? 1
              : leaderboard[i].score === leaderboard[i - 1].score
                ? leaderboard.findIndex((e) => e.score === entry.score) + 1
                : i + 1
          const isExpanded = expandedId === entry.bracket_id

          return (
            <Fragment key={entry.bracket_id}>
              <tr
                style={{ borderBottom: isExpanded ? 'none' : '1px solid #f3f4f6' }}
              >
                <td style={{ padding: '11px 12px', color: '#9ca3af', fontWeight: 500, width: 32 }}>
                  {rank}
                </td>
                <td style={{ padding: '11px 12px' }}>
                  <a
                    href={`/bracket/${entry.bracket_id}`}
                    style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {entry.bracket_name}
                  </a>
                </td>
                <td style={{ padding: '11px 12px', color: '#374151' }}>{entry.display_name}</td>
                {hasChampPicks && (
                  <td style={{ padding: '11px 12px', color: '#6b7280', fontSize: 13 }}>
                    {entry.champion_pick ? (
                      <ChampionBadge champion={entry.champion_pick} />
                    ) : (
                      <span style={{ color: '#d1d5db' }}>—</span>
                    )}
                  </td>
                )}
                <td
                  onClick={() => setExpandedId(isExpanded ? null : entry.bracket_id)}
                  style={{
                    padding: '11px 12px',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: 'pointer',
                    userSelect: 'none',
                    position: 'relative',
                  }}
                  title="Click to see scoring breakdown"
                >
                  {entry.score}
                  <span
                    style={{
                      display: 'inline-block',
                      marginLeft: 5,
                      fontSize: 10,
                      color: '#9ca3af',
                      transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                    }}
                  >
                    ▼
                  </span>
                </td>
                {anyScored && (
                  <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                    <span
                      title="Max points still achievable"
                      style={{ color: '#9ca3af', fontSize: 13 }}
                    >
                      {entry.max_possible}
                    </span>
                  </td>
                )}
              </tr>

              {/* Expanded breakdown row */}
              {isExpanded && (
                <tr key={`${entry.bracket_id}-breakdown`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td colSpan={colCount} style={{ padding: '0 12px 14px 12px' }}>
                    <div
                      style={{
                        background: '#f9fafb',
                        borderRadius: 8,
                        border: '1px solid #f3f4f6',
                        padding: '12px 14px',
                        fontSize: 12,
                      }}
                    >
                      {/* Breakdown table */}
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: 12,
                        }}
                      >
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '4px 8px 6px 0', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>
                              Round
                            </th>
                            <th style={{ padding: '4px 8px 6px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>
                              Correct
                            </th>
                            <th style={{ padding: '4px 8px 6px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>
                              Wrong
                            </th>
                            <th style={{ padding: '4px 8px 6px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>
                              Pts Earned
                            </th>
                            <th style={{ padding: '4px 0 6px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>
                              Pts Possible
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ROUND_LABELS.map((label, r) => {
                            const bd = entry.breakdown[r]
                            const completed = completedPerRound[r] ?? 0
                            const totalGames = GAMES_PER_ROUND[r]
                            const maxPts = totalGames * ROUND_MULTIPLIERS[r]
                            const hasGames = completed > 0

                            return (
                              <tr
                                key={r}
                                style={{
                                  borderBottom: r < 5 ? '1px solid #f3f4f6' : 'none',
                                  color: hasGames ? '#374151' : '#d1d5db',
                                }}
                              >
                                <td style={{ padding: '5px 8px 5px 0', fontWeight: 500 }}>
                                  {label}
                                  <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 4, fontSize: 11 }}>
                                    ×{ROUND_MULTIPLIERS[r]}
                                  </span>
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                  {hasGames ? (
                                    <span>
                                      <span style={{ fontWeight: 600, color: '#059669' }}>{bd.correct}</span>
                                      <span style={{ color: '#9ca3af' }}>/{completed}</span>
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                  {hasGames ? (
                                    <span style={{ color: bd.wrong > 0 ? '#dc2626' : '#9ca3af' }}>
                                      {bd.wrong}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: hasGames ? 600 : 400 }}>
                                  {hasGames ? bd.points : '—'}
                                </td>
                                <td style={{ padding: '5px 0 5px 8px', textAlign: 'right', color: '#9ca3af' }}>
                                  {maxPts}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                            <td style={{ padding: '6px 8px 4px 0', fontWeight: 700 }}>Total</td>
                            <td style={{ padding: '6px 8px 4px', textAlign: 'right' }}>
                              <span style={{ fontWeight: 600, color: '#059669' }}>
                                {entry.breakdown.reduce((s, b) => s + b.correct, 0)}
                              </span>
                              <span style={{ color: '#9ca3af' }}>
                                /{Object.values(completedPerRound).reduce((s, n) => s + n, 0)}
                              </span>
                            </td>
                            <td style={{ padding: '6px 8px 4px', textAlign: 'right', color: '#dc2626' }}>
                              {entry.breakdown.reduce((s, b) => s + b.wrong, 0)}
                            </td>
                            <td style={{ padding: '6px 8px 4px', textAlign: 'right', fontWeight: 700 }}>
                              {entry.score}
                            </td>
                            <td style={{ padding: '6px 0 4px 8px', textAlign: 'right', color: '#9ca3af' }}>
                              {GAMES_PER_ROUND.reduce((s, g, r) => s + g * ROUND_MULTIPLIERS[r], 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Link to full audit */}
                      <div style={{ marginTop: 10, textAlign: 'right' }}>
                        <a
                          href={`/bracket/${entry.bracket_id}`}
                          style={{
                            fontSize: 12,
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}
                        >
                          View full bracket →
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
