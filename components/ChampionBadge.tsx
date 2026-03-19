'use client'
import { useState, useRef, useEffect } from 'react'

interface Props {
  champion: string
}

type Egg = 'wisconsin' | 'michigan' | 'msu' | 'david' | null

export default function ChampionBadge({ champion }: Props) {
  const [egg, setEgg] = useState<Egg>(null)
  const msuVideoRef = useRef<HTMLVideoElement>(null)
  const msuAudioRef = useRef<HTMLAudioElement>(null)

  const getEgg = (team: string): Egg => {
    if (team === 'Wisconsin') return 'wisconsin'
    if (team === 'Michigan') return 'michigan'
    if (team === 'Michigan St.') return 'msu'
    return 'david'
  }

  useEffect(() => {
    if (egg === 'msu') {
      msuVideoRef.current?.play().catch(() => {})
      msuAudioRef.current?.play().catch(() => {})
      const t = setTimeout(() => setEgg(null), 6200)
      return () => {
        clearTimeout(t)
        msuVideoRef.current?.pause()
        msuAudioRef.current?.pause()
      }
    } else if (egg) {
      const t = setTimeout(() => setEgg(null), 4000)
      return () => clearTimeout(t)
    }
  }, [egg])

  return (
    <>
      <span
        onClick={() => setEgg(getEgg(champion))}
        title="Click me 👀"
        style={{ cursor: 'pointer', borderBottom: '1px dashed #d1d5db' }}
      >
        {champion}
      </span>

      {egg && (
        <div
          onClick={() => setEgg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: egg === 'msu' ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.82)',
            cursor: 'pointer',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp {
              0% { transform: translateY(60px) scale(0.9); opacity: 0; }
              60% { transform: translateY(-8px) scale(1.02); opacity: 1; }
              100% { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes headShake {
              0% { transform: rotate(0deg); } 15% { transform: rotate(-3deg); }
              30% { transform: rotate(3deg); } 45% { transform: rotate(-2deg); }
              60% { transform: rotate(1deg); } 100% { transform: rotate(0deg); }
            }
            @keyframes pulseText { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
            @keyframes fadeOut { 0% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
          `}</style>

          {/* David — everyone else */}
          {egg === 'david' && (
            <div style={{ animation: 'slideUp 0.5s ease-out, fadeOut 4s ease-in forwards', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 220, height: 220, borderRadius: '50%', overflow: 'hidden', border: '4px solid #18453B', boxShadow: '0 0 40px rgba(24,69,59,0.6)', animation: 'headShake 0.8s ease-in-out 0.4s' }}>
                <img src="/disappointed-david.jpg" alt="Disappointed David" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
              </div>
              <div style={{ textAlign: 'center', animation: 'pulseText 1.5s ease-in-out infinite' }}>
                <div style={{ fontSize: 28, fontWeight: 500, color: '#fff', textShadow: '0 2px 20px rgba(24,69,59,0.8)', letterSpacing: -0.5 }}>David is disappointed in you.</div>
                <div style={{ fontSize: 14, color: '#18453B', fontWeight: 500, marginTop: 6, background: 'rgba(255,255,255,0.9)', display: 'inline-block', padding: '4px 14px', borderRadius: 20 }}>Go Green. Go White.</div>
              </div>
            </div>
          )}

          {/* JP — Michigan */}
          {egg === 'michigan' && (
            <div style={{ animation: 'slideUp 0.5s ease-out, fadeOut 4s ease-in forwards', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 220, height: 220, borderRadius: '50%', overflow: 'hidden', border: '4px solid #00274C', boxShadow: '0 0 40px rgba(0,39,76,0.7), 0 0 80px rgba(255,203,5,0.3)', animation: 'headShake 0.8s ease-in-out 0.4s' }}>
                <img src="/jp-proud.jpg" alt="JP is proud" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
              </div>
              <div style={{ textAlign: 'center', animation: 'pulseText 1.5s ease-in-out infinite' }}>
                <div style={{ fontSize: 28, fontWeight: 500, color: '#FFCB05', textShadow: '0 2px 20px rgba(0,39,76,0.9)', letterSpacing: -0.5 }}>JP is proud of you!</div>
                <div style={{ fontSize: 14, color: '#FFCB05', fontWeight: 500, marginTop: 6, background: '#00274C', display: 'inline-block', padding: '4px 14px', borderRadius: 20 }}>Go Blue! 〽️</div>
              </div>
            </div>
          )}

          {/* Pukalls — Wisconsin */}
          {egg === 'wisconsin' && (
            <div style={{ animation: 'slideUp 0.5s ease-out, fadeOut 4s ease-in forwards', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 280, height: 210, borderRadius: 16, overflow: 'hidden', border: '4px solid #C5050C', boxShadow: '0 0 40px rgba(197,5,12,0.6)', animation: 'headShake 0.8s ease-in-out 0.4s' }}>
                <img src="/pukall-cheers.jpg" alt="The Pukalls cheering" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }} />
              </div>
              <div style={{ textAlign: 'center', animation: 'pulseText 1.5s ease-in-out infinite' }}>
                <div style={{ fontSize: 28, fontWeight: 500, color: '#fff', textShadow: '0 2px 20px rgba(197,5,12,0.8)', letterSpacing: -0.5 }}>Cheers from the Pukalls!</div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 500, marginTop: 6, background: '#C5050C', display: 'inline-block', padding: '4px 14px', borderRadius: 20 }}>On, Wisconsin! 🦡</div>
              </div>
            </div>
          )}

          {/* MSU Championship */}
          {egg === 'msu' && (
            <div style={{ animation: 'slideUp 0.5s ease-out', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 320, maxWidth: '85vw', borderRadius: 16, overflow: 'hidden', border: '4px solid #18453B', boxShadow: '0 0 60px rgba(24,69,59,0.7)' }}>
                <video ref={msuVideoRef} src="/msu-champ.mp4" muted playsInline style={{ width: '100%', display: 'block' }} />
              </div>
              <audio ref={msuAudioRef} src="/one-shining-moment.mp3" preload="auto" />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#fff', textShadow: '0 2px 20px rgba(24,69,59,0.9)', letterSpacing: -0.5 }}>✨ One Shining Moment ✨</div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 500, marginTop: 6, background: '#18453B', display: 'inline-block', padding: '4px 14px', borderRadius: 20 }}>Go Green! Go White!</div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
