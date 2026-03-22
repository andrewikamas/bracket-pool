"use client";
import { useState, useCallback, useRef, useEffect } from "react";

// 2026 NCAA Tournament Data (Round of 64 — skipping First Four)
const REGIONS = {
  South: {
    games: [
      { id: "S1", seed1: 1, team1: "Florida", seed2: 16, team2: "PV A&M/Lehigh", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Oklahoma City, OK" },
      { id: "S2", seed1: 8, team1: "Clemson", seed2: 9, team2: "Iowa", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Oklahoma City, OK" },
      { id: "S3", seed1: 5, team1: "Vanderbilt", seed2: 12, team2: "McNeese", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Oklahoma City, OK" },
      { id: "S4", seed1: 4, team1: "Nebraska", seed2: 13, team2: "Troy", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Oklahoma City, OK" },
      { id: "S5", seed1: 6, team1: "North Carolina", seed2: 11, team2: "VCU", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Greenville, SC" },
      { id: "S6", seed1: 3, team1: "Illinois", seed2: 14, team2: "Penn", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Greenville, SC" },
      { id: "S7", seed1: 7, team1: "Saint Mary's", seed2: 10, team2: "Texas A&M", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Oklahoma City, OK" },
      { id: "S8", seed1: 2, team1: "Houston", seed2: 15, team2: "Idaho", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Oklahoma City, OK" },
    ],
  },
  East: {
    games: [
      { id: "E1", seed1: 1, team1: "Duke", seed2: 16, team2: "Siena", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Greenville, SC" },
      { id: "E2", seed1: 8, team1: "Ohio St.", seed2: 9, team2: "TCU", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Greenville, SC" },
      { id: "E3", seed1: 5, team1: "St. John's", seed2: 12, team2: "Northern Iowa", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Philadelphia, PA" },
      { id: "E4", seed1: 4, team1: "Kansas", seed2: 13, team2: "Cal Baptist", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Philadelphia, PA" },
      { id: "E5", seed1: 6, team1: "Louisville", seed2: 11, team2: "South Florida", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Buffalo, NY" },
      { id: "E6", seed1: 3, team1: "Michigan St.", seed2: 14, team2: "N. Dakota St.", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Buffalo, NY" },
      { id: "E7", seed1: 7, team1: "UCLA", seed2: 10, team2: "UCF", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Philadelphia, PA" },
      { id: "E8", seed1: 2, team1: "UConn", seed2: 15, team2: "Furman", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "Philadelphia, PA" },
    ],
  },
  West: {
    games: [
      { id: "W1", seed1: 1, team1: "Arizona", seed2: 16, team2: "LIU", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "San Diego, CA" },
      { id: "W2", seed1: 8, team1: "Villanova", seed2: 9, team2: "Utah St.", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "San Diego, CA" },
      { id: "W3", seed1: 5, team1: "Wisconsin", seed2: 12, team2: "High Point", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Portland, OR" },
      { id: "W4", seed1: 4, team1: "Arkansas", seed2: 13, team2: "Hawaii", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Portland, OR" },
      { id: "W5", seed1: 6, team1: "BYU", seed2: 11, team2: "Texas/NC State", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "San Diego, CA" },
      { id: "W6", seed1: 3, team1: "Gonzaga", seed2: 14, team2: "Kennesaw St.", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "San Diego, CA" },
      { id: "W7", seed1: 7, team1: "Miami (FL)", seed2: 10, team2: "Missouri", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "St. Louis, MO" },
      { id: "W8", seed1: 2, team1: "Purdue", seed2: 15, team2: "Queens", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Portland, OR" },
    ],
  },
  Midwest: {
    games: [
      { id: "M1", seed1: 1, team1: "Michigan", seed2: 16, team2: "UMBC/Howard", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Buffalo, NY" },
      { id: "M2", seed1: 8, team1: "Georgia", seed2: 9, team2: "Saint Louis", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Buffalo, NY" },
      { id: "M3", seed1: 5, team1: "Texas Tech", seed2: 12, team2: "Akron", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Buffalo, NY" },
      { id: "M4", seed1: 4, team1: "Alabama", seed2: 13, team2: "Hofstra", date: "Thu Mar 19", time: "TBD", tv: "TBD", venue: "Buffalo, NY" },
      { id: "M5", seed1: 6, team1: "Tennessee", seed2: 11, team2: "SMU/Miami (OH)", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "St. Louis, MO" },
      { id: "M6", seed1: 3, team1: "Virginia", seed2: 14, team2: "Wright St.", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "St. Louis, MO" },
      { id: "M7", seed1: 7, team1: "Kentucky", seed2: 10, team2: "Santa Clara", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "St. Louis, MO" },
      { id: "M8", seed1: 2, team1: "Iowa St.", seed2: 15, team2: "Tennessee St.", date: "Fri Mar 20", time: "TBD", tv: "TBD", venue: "St. Louis, MO" },
    ],
  },
};

const ROUND_NAMES = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"];

const COLORS = {
  South: { bg: "#E1F5EE", border: "#0F6E56", text: "#085041", light: "#9FE1CB" },
  West: { bg: "#FAECE7", border: "#993C1D", text: "#712B13", light: "#F5C4B3" },
  East: { bg: "#E6F1FB", border: "#185FA5", text: "#0C447C", light: "#B5D4F4" },
  Midwest: { bg: "#EEEDFE", border: "#534AB7", text: "#3C3489", light: "#CECBF6" },
  FinalFour: { bg: "#FAEEDA", border: "#854F0B", text: "#633806", light: "#FAC775" },
};

// ESPN event IDs for R64 games — Thursday games confirmed; Friday IDs TBD (will resolve via team matching)
const ESPN_GAME_IDS = {
  E1: "401856478", E2: "401856479", W3: "401856480", W4: "401856481",
  E5: "401856482", E6: "401856483", W5: "401856484", W6: "401856485",
  M1: "401856486", M2: "401856487", S3: "401856488", S4: "401856489",
  S5: "401856490", S6: "401856491", S7: "401856492", S8: "401856493",
};

function getRegionForGame(gameId) {
  if (gameId.startsWith("S")) return "South";
  if (gameId.startsWith("W")) return "West";
  if (gameId.startsWith("E")) return "East";
  if (gameId.startsWith("M")) return "Midwest";
  return "FinalFour";
}

export default function NCAABracket({ initialPicks = {}, initialTiebreaker = "", locked = false, gameSchedule = {}, gameResults = {}, onPicksChange = null, onTiebreakerChange = null } = {}) {
  // gameSchedule: Record<gameId, { time, tv, venue, game_time }>
  // gameResults: Record<gameId, string> — winning team NAME for completed games
  // Passed in from the server — overrides the static TBD values in REGIONS
  const [picks, setPicks] = useState(initialPicks);
  const [activeRegion, setActiveRegion] = useState("South");
  const [showFinalFour, setShowFinalFour] = useState(false);
  const [tiebreaker, setTiebreaker] = useState(initialTiebreaker);
  const [showDisappointment, setShowDisappointment] = useState(false);
  const [showJPPride, setShowJPPride] = useState(false);
  const [showPukallCheers, setShowPukallCheers] = useState(false);
  const [showMSUChamp, setShowMSUChamp] = useState(false);
  const msuVideoRef = useRef(null);
  const msuAudioRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-dismiss the MSU easter egg
  useEffect(() => {
    if (showDisappointment) {
      const timer = setTimeout(() => setShowDisappointment(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showDisappointment]);

  // Auto-dismiss the Michigan easter egg
  useEffect(() => {
    if (showJPPride) {
      const timer = setTimeout(() => setShowJPPride(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showJPPride]);

  // Auto-dismiss the Wisconsin/Pukall easter egg
  useEffect(() => {
    if (showPukallCheers) {
      const timer = setTimeout(() => setShowPukallCheers(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showPukallCheers]);

  // MSU Championship easter egg — play video + One Shining Moment for 6s
  useEffect(() => {
    if (showMSUChamp) {
      if (msuVideoRef.current) {
        msuVideoRef.current.currentTime = 0;
        msuVideoRef.current.play().catch(() => {});
      }
      if (msuAudioRef.current) {
        msuAudioRef.current.currentTime = 0;
        msuAudioRef.current.play().catch(() => {});
      }
      const timer = setTimeout(() => setShowMSUChamp(false), 6200);
      return () => {
        clearTimeout(timer);
        if (msuVideoRef.current) msuVideoRef.current.pause();
        if (msuAudioRef.current) msuAudioRef.current.pause();
      };
    }
  }, [showMSUChamp]);

  // Responsive width tracking
  const [windowWidth, setWindowWidth] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth : 1024)
  );
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = windowWidth < 480;

  // Auto-fetch ESPN schedule so TV/time/venue work without a parent passing gameSchedule
  const [fetchedSchedule, setFetchedSchedule] = useState({});
  useEffect(() => {
    const espnToGame = Object.fromEntries(
      Object.entries(ESPN_GAME_IDS).map(([g, e]) => [e, g])
    );
    const run = async () => {
      try {
        const results = {};
        for (const date of ["20260319", "20260320"]) {
          const res = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=100&limit=50`
          );
          if (!res.ok) continue;
          const data = await res.json();
          const events = (data.events ?? []).filter(
            (e) =>
              e.tournamentId === 22 ||
              e.competitions?.[0]?.notes?.[0]?.headline?.includes("NCAA Men's Basketball Championship")
          );
          for (const event of events) {
            const gameId = espnToGame[event.id];
            if (!gameId) continue;
            const comp = event.competitions?.[0];
            const detail = event.status?.type?.detail ?? "";
            const timeMatch = detail.match(/at (.+)$/);
            results[gameId] = {
              // geoBroadcasts lives on competitions[0], not on the event root
              tv: comp?.geoBroadcasts?.[0]?.media?.shortName ?? null,
              game_time: timeMatch ? timeMatch[1] : null,
              venue: comp?.venue
                ? `${comp.venue.fullName}, ${comp.venue.address?.city}, ${comp.venue.address?.state}`
                : null,
            };
          }
        }
        setFetchedSchedule(results);
      } catch (e) {
        console.warn("ESPN schedule fetch failed:", e);
      }
    };
    run();
  }, []);

  // Prop-supplied schedule takes precedence over auto-fetched
  const mergedSchedule = { ...fetchedSchedule, ...gameSchedule };

  // Build full bracket structure with 6 rounds
  const getTeamForSlot = useCallback(
    (region, round, slot) => {
      if (round === 0) {
        const game = REGIONS[region].games[slot];
        return { seed1: game.seed1, team1: game.team1, seed2: game.seed2, team2: game.team2 };
      }
      const prevSlot1 = slot * 2;
      const prevSlot2 = slot * 2 + 1;
      const gameId1 = `${region[0]}R${round - 1}G${prevSlot1}`;
      const gameId2 = `${region[0]}R${round - 1}G${prevSlot2}`;

      let team1 = null, seed1 = null, team2 = null, seed2 = null;

      if (round === 1) {
        const g1 = REGIONS[region].games[prevSlot1];
        const g2 = REGIONS[region].games[prevSlot2];
        const pick1 = picks[g1.id];
        const pick2 = picks[g2.id];
        if (pick1) { team1 = pick1 === 1 ? g1.team1 : g1.team2; seed1 = pick1 === 1 ? g1.seed1 : g1.seed2; }
        if (pick2) { team2 = pick2 === 1 ? g2.team1 : g2.team2; seed2 = pick2 === 1 ? g2.seed1 : g2.seed2; }
      } else {
        const prev1 = getTeamForSlot(region, round - 1, prevSlot1);
        const prev2 = getTeamForSlot(region, round - 1, prevSlot2);
        const pickKey1 = `${region[0]}R${round - 1}G${prevSlot1}`;
        const pickKey2 = `${region[0]}R${round - 1}G${prevSlot2}`;
        const p1 = picks[pickKey1];
        const p2 = picks[pickKey2];
        if (p1 === 1 && prev1.team1) { team1 = prev1.team1; seed1 = prev1.seed1; }
        else if (p1 === 2 && prev1.team2) { team1 = prev1.team2; seed1 = prev1.seed2; }
        if (p2 === 1 && prev2.team1) { team2 = prev2.team1; seed2 = prev2.seed1; }
        else if (p2 === 2 && prev2.team2) { team2 = prev2.team2; seed2 = prev2.seed2; }
      }
      return { seed1, team1, seed2, team2 };
    },
    [picks]
  );

  const handlePick = (gameId, choice) => {
    if (locked) return;
    setPicks((prev) => {
      const next = { ...prev };
      if (next[gameId] === choice) {
        delete next[gameId];
        clearDownstream(next, gameId);
      } else {
        if (next[gameId] && next[gameId] !== choice) {
          clearDownstream(next, gameId);
        }
        next[gameId] = choice;
      }
      if (onPicksChange) setTimeout(() => onPicksChange(next), 0);
      return next;
    });
  };

  const clearDownstream = (pickState, gameId) => {
    const region = gameId[0];
    let round, slot;

    // Parse R64 format (e.g. "S1") vs later rounds (e.g. "SR1G0")
    const laterParts = gameId.match(/R(\d+)G(\d+)/);
    if (laterParts) {
      round = parseInt(laterParts[1]);
      slot = parseInt(laterParts[2]);
    } else {
      // R64 game: region letter + number (1-indexed)
      round = 0;
      slot = parseInt(gameId.slice(1)) - 1;
      if (isNaN(slot)) return;
    }

    // Find the next game this feeds into
    if (round < 3) {
      const nextRound = round + 1;
      const nextSlot = Math.floor(slot / 2);
      const nextKey = `${region}R${nextRound}G${nextSlot}`;
      if (pickState[nextKey] !== undefined) {
        delete pickState[nextKey];
        clearDownstream(pickState, nextKey);
      }
    } else if (round === 3) {
      // Elite 8 winner feeds into Final Four
      // South/East -> FF1, West/Midwest -> FF2
      const ffKey = (region === "S" || region === "E") ? "FF1" : "FF2";
      if (pickState[ffKey] !== undefined) {
        delete pickState[ffKey];
        // FF feeds into championship
        if (pickState["CHAMP"] !== undefined) {
          delete pickState["CHAMP"];
        }
      }
    }
    // Final Four -> Championship
    if (gameId === "FF1" || gameId === "FF2") {
      if (pickState["CHAMP"] !== undefined) {
        delete pickState["CHAMP"];
      }
    }
  };

  const totalPicks = Object.keys(picks).length;

  const Matchup = ({ gameId, team1, seed1, team2, seed2, round, compact, info }) => {
    const pick = picks[gameId];
    const winnerName = gameResults[gameId]; // winning team's NAME, or undefined if not decided
    const regionKey = getRegionForGame(gameId);
    const c = COLORS[regionKey] || COLORS.FinalFour;
    const h = compact ? 32 : 36;

    return (
      <div style={{ margin: compact ? "2px 0" : "4px 0", minWidth: compact ? 140 : 160 }}>
        {[
          { team: team1, seed: seed1, choice: 1 },
          { team: team2, seed: seed2, choice: 2 },
        ].map(({ team, seed, choice }) => {
          const selected = pick === choice;
          const faded = pick && !selected;
          const canPick = !!team;
          const losingTeam = choice === 1 ? team2 : team1;

          // Result-based styling: compare by team NAME, not by 1/2 choice
          const hasResult = !!winnerName;
          const isActualWinner = hasResult && team === winnerName;
          const isActualLoser = hasResult && !!team && team !== winnerName;
          const pickCorrect = hasResult && selected && team === winnerName;
          const pickWrong = hasResult && selected && team !== winnerName;

          // Choose background
          let bg, borderColor;
          if (pickCorrect) {
            bg = "#ecfdf5";
            borderColor = "#10b981";
          } else if (pickWrong) {
            bg = "#fef2f2";
            borderColor = "#ef4444";
          } else if (selected) {
            bg = c.bg;
            borderColor = c.border;
          } else {
            bg = "var(--color-background-secondary)";
            borderColor = "transparent";
          }

          // Opacity
          let opacity;
          if (isActualLoser && !selected) {
            opacity = 0.35;
          } else if (faded && !hasResult) {
            opacity = 0.4;
          } else if (team) {
            opacity = 1;
          } else {
            opacity = 0.25;
          }

          return (
            <div
              key={choice}
              onClick={() => {
                if (!canPick) return;
                if (losingTeam === "Michigan St." && picks[gameId] !== choice) {
                  setShowDisappointment(true);
                }
                if (team === "Michigan" && gameId === "MR3G0" && picks[gameId] !== choice) {
                  setShowJPPride(true);
                }
                if (team === "Wisconsin" && gameId === "W3" && picks[gameId] !== choice) {
                  setShowPukallCheers(true);
                }
                if (team === "Michigan St." && gameId === "CHAMP" && picks[gameId] !== choice) {
                  setShowMSUChamp(true);
                }
                handlePick(gameId, choice);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: `0 ${compact ? 6 : 8}px`,
                height: h,
                background: bg,
                borderLeft: `3px solid ${borderColor}`,
                borderBottom: choice === 1 ? `1px solid var(--color-border-tertiary)` : "none",
                borderRadius: choice === 1 ? "6px 6px 0 0" : "0 0 6px 6px",
                cursor: canPick ? "pointer" : "default",
                opacity,
                transition: "all 0.15s ease",
                fontSize: compact ? 12 : 13,
              }}
            >
              {seed && (
                <span
                  style={{
                    fontWeight: isActualWinner ? 600 : 500,
                    fontSize: compact ? 10 : 11,
                    color: pickCorrect ? "#059669" : pickWrong ? "#dc2626" : selected ? c.text : "var(--color-text-tertiary)",
                    minWidth: 16,
                    textAlign: "right",
                  }}
                >
                  {seed}
                </span>
              )}
              <span
                style={{
                  fontWeight: isActualWinner ? 600 : selected ? 500 : 400,
                  color: pickCorrect ? "#065f46" : pickWrong ? "#991b1b" : selected ? c.text : team ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {team || "TBD"}
              </span>
              {pickCorrect && (
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#10b981", fontWeight: 700 }}>✓</span>
              )}
              {pickWrong && (
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#ef4444", fontWeight: 700 }}>✗</span>
              )}
              {selected && !hasResult && !locked && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: c.border }}>✓</span>
              )}
            </div>
          );
        })}
        {info && !isMobile && (
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              padding: "3px 8px",
              fontSize: 10,
              color: "var(--color-text-tertiary)",
              lineHeight: 1.3,
            }}
          >
            <span>{info.date}</span>
            {(info.time !== "TBD" || info.game_time) && <span>· {info.game_time ?? info.time}</span>}
            {(info.tv && info.tv !== "TBD") && (
              <span style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>· {info.tv}</span>
            )}
            <span>· {info.venue}</span>
          </div>
        )}
      </div>
    );
  };

  const RegionBracket = ({ region }) => {
    const data = REGIONS[region];
    const c = COLORS[region];
    const rounds = [0, 1, 2, 3]; // R64, R32, S16, E8

    return (
      <div style={{ padding: "0 0 16px" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 8,
          }}
          ref={scrollRef}
        >
          {rounds.map((round) => {
            const gamesInRound = round === 0 ? 8 : round === 1 ? 4 : round === 2 ? 2 : 1;
            return (
              <div key={round} style={{ minWidth: round === 0 ? 200 : round === 1 ? 170 : 155, flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {ROUND_NAMES[round]}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-around",
                    minHeight: round === 0 ? "auto" : round === 1 ? 560 : round === 2 ? 560 : 560,
                    gap: round === 0 ? 6 : 0,
                  }}
                >
                  {Array.from({ length: gamesInRound }).map((_, slot) => {
                    let gameId, team1, seed1, team2, seed2, info;
                    if (round === 0) {
                      const g = data.games[slot];
                      gameId = g.id;
                      team1 = g.team1; seed1 = g.seed1;
                      team2 = g.team2; seed2 = g.seed2;
                      const sched = mergedSchedule[g.id];
                      info = {
                        date:  g.date,
                        time:  sched?.game_time ?? sched?.time ?? g.time,
                        tv:    sched?.tv   ?? g.tv,
                        venue: sched?.venue ?? g.venue,
                      };
                    } else {
                      gameId = `${region[0]}R${round}G${slot}`;
                      const t = getTeamForSlot(region, round, slot);
                      team1 = t.team1; seed1 = t.seed1;
                      team2 = t.team2; seed2 = t.seed2;
                    }
                    return (
                      <Matchup
                        key={gameId}
                        gameId={gameId}
                        team1={team1}
                        seed1={seed1}
                        team2={team2}
                        seed2={seed2}
                        round={round}
                        compact={round === 0}
                        info={info}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getRegionWinner = (region) => {
    const key = `${region[0]}R3G0`;
    const pick = picks[key];
    if (!pick) return { team: null, seed: null };
    const t = getTeamForSlot(region, 3, 0);
    if (pick === 1 && t.team1) return { team: t.team1, seed: t.seed1 };
    if (pick === 2 && t.team2) return { team: t.team2, seed: t.seed2 };
    return { team: null, seed: null };
  };

  const f4 = {
    south: getRegionWinner("South"),
    east: getRegionWinner("East"),
    west: getRegionWinner("West"),
    midwest: getRegionWinner("Midwest"),
  };

  return (
    <div style={{ fontFamily: "var(--font-sans, system-ui)", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            2026 NCAA tournament bracket
          </h1>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
            Click a team to advance them. {totalPicks}/63 picks made.
          </p>
        </div>
        <div
          style={{
            background: "var(--color-background-secondary)",
            borderRadius: 8,
            padding: "4px 6px",
            display: "flex",
            gap: 2,
            overflowX: "auto",
            flexWrap: "nowrap",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            width: isMobile ? "100%" : "auto",
          }}
        >
          {["South", "West", "East", "Midwest", "Final Four"].map((r) => {
            const active = r === "Final Four" ? showFinalFour : !showFinalFour && activeRegion === r;
            const c = r === "Final Four" ? COLORS.FinalFour : COLORS[r];
            return (
              <button
                key={r}
                onClick={() => {
                  if (r === "Final Four") {
                    setShowFinalFour(true);
                  } else {
                    setShowFinalFour(false);
                    setActiveRegion(r);
                  }
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: active ? 500 : 400,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: active ? c.bg : "transparent",
                  color: active ? c.text : "var(--color-text-secondary)",
                  transition: "all 0.15s",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: "var(--color-border-tertiary)",
          borderRadius: 2,
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(totalPicks / 63) * 100}%`,
            background: "var(--color-text-info)",
            borderRadius: 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Region bracket or Final Four */}
      {!showFinalFour ? (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: COLORS[activeRegion].bg,
                border: `1.5px solid ${COLORS[activeRegion].border}`,
              }}
            />
            <span style={{ fontSize: 15, fontWeight: 500, color: COLORS[activeRegion].text }}>
              {activeRegion} region
            </span>
          </div>
          <RegionBracket region={activeRegion} />
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: COLORS.FinalFour.text, marginBottom: 12 }}>
            Final Four & Championship
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {/* Semi 1: South vs East */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Semifinal 1
              </div>
              <Matchup
                gameId="FF1"
                team1={f4.south.team}
                seed1={f4.south.seed}
                team2={f4.east.team}
                seed2={f4.east.seed}
                info={{ date: "Sat Apr 4", time: "6:00 PM ET", tv: "TBS", venue: "Indianapolis, IN" }}
              />
              <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                South winner vs East winner
              </div>
            </div>
            {/* Semi 2: West vs Midwest */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Semifinal 2
              </div>
              <Matchup
                gameId="FF2"
                team1={f4.west.team}
                seed1={f4.west.seed}
                team2={f4.midwest.team}
                seed2={f4.midwest.seed}
                info={{ date: "Sat Apr 4", time: "8:30 PM ET", tv: "TBS", venue: "Indianapolis, IN" }}
              />
              <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                West winner vs Midwest winner
              </div>
            </div>
            {/* Championship */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Championship
              </div>
              {(() => {
                const ff1Pick = picks["FF1"];
                const ff2Pick = picks["FF2"];
                let t1 = null, s1 = null, t2 = null, s2 = null;
                if (ff1Pick === 1) { t1 = f4.south.team; s1 = f4.south.seed; }
                else if (ff1Pick === 2) { t1 = f4.east.team; s1 = f4.east.seed; }
                if (ff2Pick === 1) { t2 = f4.west.team; s2 = f4.west.seed; }
                else if (ff2Pick === 2) { t2 = f4.midwest.team; s2 = f4.midwest.seed; }
                return <Matchup gameId="CHAMP" team1={t1} seed1={s1} team2={t2} seed2={s2} info={{ date: "Mon Apr 6", time: "8:30 PM ET", tv: "TBS", venue: "Indianapolis, IN" }} />;
              })()}
              {/* Tiebreaker */}
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
                  Tiebreaker: total combined score
                </label>
                <input
                  type="number"
                  value={tiebreaker}
                  onChange={(e) => {
                    if (!locked) {
                      setTiebreaker(e.target.value);
                      if (onTiebreakerChange) onTiebreakerChange(e.target.value);
                    }
                  }}
                  placeholder="e.g. 142"
                  disabled={locked}
                  style={{
                    width: 80,
                    padding: "6px 8px",
                    fontSize: 13,
                    border: "1px solid var(--color-border-tertiary)",
                    borderRadius: 6,
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-primary)",
                    opacity: locked ? 0.6 : 1,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pick summary */}
      <div
        style={{
          marginTop: 20,
          padding: 12,
          background: "var(--color-background-secondary)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--color-text-secondary)",
        }}
      >
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {["South", "West", "East", "Midwest"].map((r) => {
            const regionPicks = Object.keys(picks).filter(
              (k) => k.startsWith(r[0]) && !k.startsWith("FF") && !k.startsWith("CH")
            ).length;
            const w = getRegionWinner(r);
            return (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: COLORS[r].border,
                  }}
                />
                <span>
                  {r}: {regionPicks}/15
                  {w.team && <span style={{ fontWeight: 500, color: COLORS[r].text }}> → {w.team}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* MSU Easter Egg Overlay */}
      {showDisappointment && (
        <div
          onClick={() => setShowDisappointment(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.82)",
            cursor: "pointer",
            animation: "fadeIn 0.3s ease-out",
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
              0% { transform: rotate(0deg); }
              15% { transform: rotate(-3deg); }
              30% { transform: rotate(3deg); }
              45% { transform: rotate(-2deg); }
              60% { transform: rotate(1deg); }
              75% { transform: rotate(0deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes pulseText {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
            @keyframes fadeOut {
              0% { opacity: 1; }
              80% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
          <div
            style={{
              animation: "slideUp 0.5s ease-out, fadeOut 4s ease-in forwards",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: "50%",
                overflow: "hidden",
                border: "4px solid #18453B",
                boxShadow: "0 0 40px rgba(24, 69, 59, 0.6), 0 0 80px rgba(24, 69, 59, 0.3)",
                animation: "headShake 0.8s ease-in-out 0.4s",
              }}
            >
              <img
                src="/disappointed-david.jpg"
                alt="Disappointed David"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 15%",
                }}
              />
            </div>
            <div
              style={{
                textAlign: "center",
                animation: "pulseText 1.5s ease-in-out infinite",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  color: "#fff",
                  textShadow: "0 2px 20px rgba(24, 69, 59, 0.8)",
                  letterSpacing: -0.5,
                }}
              >
                David is disappointed in you.
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#18453B",
                  fontWeight: 500,
                  marginTop: 6,
                  background: "rgba(255,255,255,0.9)",
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: 20,
                }}
              >
                Go Green. Go White.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Michigan / JP Easter Egg Overlay */}
      {showJPPride && (
        <div
          onClick={() => setShowJPPride(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.82)",
            cursor: "pointer",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              animation: "slideUp 0.5s ease-out, fadeOut 4s ease-in forwards",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: "50%",
                overflow: "hidden",
                border: "4px solid #00274C",
                boxShadow: "0 0 40px rgba(0, 39, 76, 0.7), 0 0 80px rgba(255, 203, 5, 0.3)",
                animation: "headShake 0.8s ease-in-out 0.4s",
              }}
            >
              <img
                src="/jp-proud.jpg"
                alt="JP is proud"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 20%",
                }}
              />
            </div>
            <div
              style={{
                textAlign: "center",
                animation: "pulseText 1.5s ease-in-out infinite",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  color: "#FFCB05",
                  textShadow: "0 2px 20px rgba(0, 39, 76, 0.9)",
                  letterSpacing: -0.5,
                }}
              >
                JP is proud of you!
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#FFCB05",
                  fontWeight: 500,
                  marginTop: 6,
                  background: "#00274C",
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: 20,
                }}
              >
                Go Blue! 〽️
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Wisconsin / Pukall Easter Egg Overlay */}
      {showPukallCheers && (
        <div
          onClick={() => setShowPukallCheers(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.82)",
            cursor: "pointer",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              animation: "slideUp 0.5s ease-out, fadeOut 4s ease-in forwards",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 280,
                height: 210,
                borderRadius: 16,
                overflow: "hidden",
                border: "4px solid #C5050C",
                boxShadow: "0 0 40px rgba(197, 5, 12, 0.6), 0 0 80px rgba(197, 5, 12, 0.25)",
                animation: "headShake 0.8s ease-in-out 0.4s",
              }}
            >
              <img
                src="/pukall-cheers.jpg"
                alt="The Pukalls cheering"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }}
              />
            </div>
            <div style={{ textAlign: "center", animation: "pulseText 1.5s ease-in-out infinite" }}>
              <div style={{ fontSize: 28, fontWeight: 500, color: "#fff", textShadow: "0 2px 20px rgba(197, 5, 12, 0.8)", letterSpacing: -0.5 }}>
                Cheers from the Pukalls!
              </div>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 500, marginTop: 6, background: "#C5050C", display: "inline-block", padding: "4px 14px", borderRadius: 20 }}>
                On, Wisconsin! 🦡
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MSU Championship Easter Egg — Video + One Shining Moment */}
      {showMSUChamp && (
        <div
          onClick={() => setShowMSUChamp(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.92)",
            cursor: "pointer",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              animation: "slideUp 0.5s ease-out",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 320,
                maxWidth: "85vw",
                borderRadius: 16,
                overflow: "hidden",
                border: "4px solid #18453B",
                boxShadow: "0 0 60px rgba(24, 69, 59, 0.7), 0 0 120px rgba(24, 69, 59, 0.3)",
              }}
            >
              <video
                ref={msuVideoRef}
                src="/msu-champ.mp4"
                muted
                playsInline
                style={{ width: "100%", display: "block" }}
              />
            </div>
            <audio ref={msuAudioRef} src="/one-shining-moment.mp3" preload="auto" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 500, color: "#fff", textShadow: "0 2px 20px rgba(24, 69, 59, 0.9)", letterSpacing: -0.5 }}>
                ✨ One Shining Moment ✨
              </div>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 500, marginTop: 6, background: "#18453B", display: "inline-block", padding: "4px 14px", borderRadius: 20 }}>
                Go Green! Go White!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
