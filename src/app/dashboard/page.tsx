"use client";

import { useState, useEffect, useRef } from "react";

interface Activity {
  id: string;
  name: string;
  startedAt: string;
  durationSecs: number;
  distanceMeters: number;
  strokeType?: string;
  source: string;
  avgPaceSecPer100?: number;
  avgSwolf?: number;
  avgHeartRate?: number;
  laps: Lap[];
  aiSummary?: string;
  kudos: { userId: string }[];
}

interface Lap {
  lapNumber: number;
  durationSecs: number;
  distanceMeters: number;
  swolf?: number;
  paceSecPer100?: number;
  avgHeartRate?: number;
}

interface ChatMsg { role: "user" | "assistant"; content: string; }

const fmtPace = (s?: number | null) => {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
};

const fmtDur = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${m % 60}m`;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const strokeIcon = (s?: string) =>
  ({ freestyle: "🏊", backstroke: "🔄", breaststroke: "🐸", butterfly: "🦋", im: "⚡", mixed: "🌊" }[s ?? ""] ?? "🌊");

const sourceClass = (s: string) =>
  ({ garmin: "garmin", apple_health: "apple", strava: "strava", manual: "manual" }[s] ?? "");

export default function Dashboard() {
  const [tab, setTab] = useState<"feed" | "coach" | "log" | "stats">("feed");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hey! I'm your AI swim coach. I've analyzed your recent sessions. What would you like to work on today — pacing, technique, or a training plan?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split("T")[0],
    durationMins: "",
    distanceMeters: "",
    poolLength: "25",
    strokeType: "freestyle",
    notes: "",
  });
  const [logLoading, setLogLoading] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const loadActivities = () =>
    fetch("/api/activities?limit=15")
      .then((r) => r.json())
      .then((d) => setActivities(d.activities ?? []))
      .catch(() => {});

  const loadUser = () =>
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: { id: string }[]) => {
        if (Array.isArray(users) && users.length > 0) setUserId(users[0].id);
      })
      .catch(() => {});

  useEffect(() => {
    Promise.all([loadActivities(), loadUser()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatHistory]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSeedError(body.error ?? `Server error ${res.status} — check Vercel logs`);
        return;
      }
      await Promise.all([loadActivities(), loadUser()]);
    } catch (e) {
      setSeedError("Network error — " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSeeding(false);
    }
  };

  const totalDist = activities.reduce((s, a) => s + a.distanceMeters, 0);
  const avgPace =
    activities.filter((a) => a.avgPaceSecPer100).reduce((s, a) => s + (a.avgPaceSecPer100 ?? 0), 0) /
    (activities.filter((a) => a.avgPaceSecPer100).length || 1);
  const avgSwolf =
    activities.filter((a) => a.avgSwolf).reduce((s, a) => s + (a.avgSwolf ?? 0), 0) /
    (activities.filter((a) => a.avgSwolf).length || 1);
  const bestPace = Math.min(...activities.filter((a) => a.avgPaceSecPer100).map((a) => a.avgPaceSecPer100!));

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatHistory((h) => [...h, { role: "user", content: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId ?? "guest",
          message: msg,
          history: chatHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setChatHistory((h) => [
        ...h,
        { role: "assistant", content: data.reply ?? "Sorry, I couldn't respond right now." },
      ]);
    } catch {
      setChatHistory((h) => [
        ...h,
        { role: "assistant", content: "Connection error — please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleLog = async () => {
    if (!logForm.durationMins || !logForm.distanceMeters || !userId) return;
    setLogLoading(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          source: "manual",
          data: {
            date: logForm.date + "T08:00:00Z",
            durationMins: Number(logForm.durationMins),
            distanceMeters: Number(logForm.distanceMeters),
            poolLength: Number(logForm.poolLength),
            strokeType: logForm.strokeType,
            notes: logForm.notes,
          },
          generateAiSummary: false,
        }),
      });
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 3000);
      await loadActivities();
    } finally {
      setLogLoading(false);
    }
  };

  const paceData = activities.filter((a) => a.avgPaceSecPer100).slice(0, 10).reverse();
  const paceMin = Math.min(...paceData.map((a) => a.avgPaceSecPer100!));
  const paceMax = Math.max(...paceData.map((a) => a.avgPaceSecPer100!));

  const isEmpty = !loading && activities.length === 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="/" className="topbar-logo" style={{ textDecoration: "none" }}>
          🌊 <span>Swim</span>Coach
        </a>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {activities.length > 0 ? `${activities.length} sessions tracked` : "No sessions yet"}
        </div>
      </header>

      <nav className="sidebar">
        {[
          { id: "feed", label: "Activity Feed", icon: "📋" },
          { id: "coach", label: "AI Coach", icon: "🤖" },
          { id: "log", label: "Log Swim", icon: "➕" },
          { id: "stats", label: "Analytics", icon: "📊" },
        ].map((item) => (
          <div
            key={item.id}
            className={`nav-item ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id as typeof tab)}
          >
            <span>{item.icon}</span>
            {item.label}
          </div>
        ))}

        <div style={{ marginTop: 24, padding: "0 20px" }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>Sources</div>
          {["Garmin", "Apple Health", "Strava", "Manual"].map((s) => (
            <div key={s} style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>
              · {s}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: "0 20px" }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>API Routes</div>
          {["GET /api/activities", "POST /api/sync", "POST /api/coach", "GET /api/users"].map((r) => (
            <div key={r} style={{ fontSize: 11, color: "var(--text-muted)", padding: "3px 0", fontFamily: "var(--font-mono)" }}>
              {r}
            </div>
          ))}
        </div>
      </nav>

      <main className="page-content">
        {/* Empty state seed banner */}
        {isEmpty && (
          <>
            <div
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.25)",
                borderRadius: "var(--radius)",
                padding: "20px 24px",
                marginBottom: seedError ? 8 : 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  No swim data yet
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Load demo data to see the full experience — 15 sessions, laps, and AI coach context.
                </div>
              </div>
              <button onClick={handleSeedDemo} disabled={seeding} style={{ flexShrink: 0 }}>
                {seeding ? "Loading…" : "Load demo data"}
              </button>
            </div>
            {seedError && (
              <div style={{ marginBottom: 24, fontSize: 12, color: "#ff6b6b", fontFamily: "var(--font-mono)", padding: "8px 4px" }}>
                Error: {seedError}
              </div>
            )}
          </>
        )}

        {/* ── FEED ── */}
        {tab === "feed" && (
          <>
            <div className="stat-grid">
              <div className="stat-tile accent">
                <div className="stat-label">Total distance</div>
                <div className="stat-value">{(totalDist / 1000).toFixed(1)}</div>
                <div className="stat-sub">km swum</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Avg pace</div>
                <div className="stat-value">{fmtPace(avgPace)}</div>
                <div className="stat-sub">per 100m</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Avg SWOLF</div>
                <div className="stat-value">{avgSwolf ? avgSwolf.toFixed(1) : "—"}</div>
                <div className="stat-sub">lower = more efficient</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Best pace</div>
                <div className="stat-value">{bestPace < 999 ? fmtPace(bestPace) : "—"}</div>
                <div className="stat-sub">personal best /100m</div>
              </div>
            </div>

            <div className="card">
              <div className="section-header">
                <div className="section-title">Recent sessions</div>
                <button className="secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setTab("log")}>
                  + Log swim
                </button>
              </div>

              {loading ? (
                <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
              ) : activities.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  Load demo data above to populate example sessions.
                </div>
              ) : (
                activities.slice(0, 8).map((a) => (
                  <div
                    key={a.id}
                    className="activity-row"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(selected?.id === a.id ? null : a)}
                  >
                    <div className="activity-icon">{strokeIcon(a.strokeType)}</div>
                    <div>
                      <div className="activity-name">{a.name}</div>
                      <div className="activity-meta">
                        {new Date(a.startedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                        {(a.distanceMeters / 1000).toFixed(1)}km · {fmtDur(a.durationSecs)} ·{" "}
                        {fmtPace(a.avgPaceSecPer100)}/100m{a.avgSwolf ? ` · SWOLF ${a.avgSwolf.toFixed(1)}` : ""}
                      </div>
                      {selected?.id === a.id && (
                        <div style={{ marginTop: 10 }}>
                          {a.laps.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div className="stat-label" style={{ marginBottom: 6 }}>Lap breakdown</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {a.laps.map((l) => (
                                  <div key={l.lapNumber} className="card-sm" style={{ fontSize: 12, minWidth: 90 }}>
                                    <div style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Lap {l.lapNumber}</div>
                                    <div className="font-mono" style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>{fmtPace(l.paceSecPer100)}/100m</div>
                                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>SWOLF {l.swolf?.toFixed(1) ?? "—"}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {a.aiSummary && (
                            <div className="card-sm" style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                              <div className="stat-label" style={{ marginBottom: 6 }}>🤖 AI Coach summary</div>
                              {a.aiSummary}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className={`badge ${sourceClass(a.source)}`}>{a.source.replace("_", " ")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── COACH ── */}
        {tab === "coach" && (
          <div className="card" style={{ maxWidth: 720 }}>
            <div className="section-header">
              <div className="section-title">🤖 AI Swim Coach</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Powered by Claude</div>
            </div>

            <div className="chat-container" ref={chatRef}>
              {chatHistory.map((m, i) => (
                <div key={i} className={`chat-bubble ${m.role}`} style={{ whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div className="chat-bubble assistant" style={{ color: "var(--text-muted)" }}>
                  <span className="spinner">⟳</span> Thinking…
                </div>
              )}
            </div>

            <div className="chat-input-row">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
                placeholder="Ask about pacing, technique, training plans…"
                disabled={chatLoading}
              />
              <button onClick={handleChat} disabled={chatLoading || !chatInput.trim()}>
                Send
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                "Analyze my SWOLF trend",
                "Build me a 6-week plan for a 1500m race",
                "Why is my backstroke slower?",
                "How should I pace a 200m IM?",
              ].map((q) => (
                <button
                  key={q}
                  className="secondary"
                  style={{ fontSize: 12, padding: "5px 10px" }}
                  onClick={() => setChatInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── LOG ── */}
        {tab === "log" && (
          <div className="card" style={{ maxWidth: 520 }}>
            <div className="section-title" style={{ marginBottom: 20 }}>Log a swim</div>

            {!userId && (
              <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 16 }}>
                Load demo data first so your swim has a user profile to attach to.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div className="stat-label" style={{ marginBottom: 6 }}>Date</div>
                <input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} />
              </div>
              <div className="grid-2">
                <div>
                  <div className="stat-label" style={{ marginBottom: 6 }}>Duration (minutes)</div>
                  <input
                    type="number"
                    placeholder="e.g. 45"
                    value={logForm.durationMins}
                    onChange={(e) => setLogForm({ ...logForm, durationMins: e.target.value })}
                  />
                </div>
                <div>
                  <div className="stat-label" style={{ marginBottom: 6 }}>Distance (meters)</div>
                  <input
                    type="number"
                    placeholder="e.g. 2000"
                    value={logForm.distanceMeters}
                    onChange={(e) => setLogForm({ ...logForm, distanceMeters: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <div className="stat-label" style={{ marginBottom: 6 }}>Pool length (m)</div>
                  <input
                    type="number"
                    placeholder="25 or 50"
                    value={logForm.poolLength}
                    onChange={(e) => setLogForm({ ...logForm, poolLength: e.target.value })}
                  />
                </div>
                <div>
                  <div className="stat-label" style={{ marginBottom: 6 }}>Stroke</div>
                  <select
                    value={logForm.strokeType}
                    onChange={(e) => setLogForm({ ...logForm, strokeType: e.target.value })}
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      padding: "10px 14px",
                      fontSize: 14,
                      width: "100%",
                    }}
                  >
                    {["freestyle", "backstroke", "breaststroke", "butterfly", "im", "mixed"].map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="stat-label" style={{ marginBottom: 6 }}>Notes (optional)</div>
                <textarea
                  rows={3}
                  placeholder="How did the session feel?"
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  style={{ resize: "vertical" }}
                />
              </div>
              <button onClick={handleLog} disabled={logLoading || !logForm.durationMins || !logForm.distanceMeters || !userId}>
                {logLoading ? "Saving…" : logSuccess ? "✓ Saved!" : "Save swim"}
              </button>

              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Computed pace:{" "}
                {logForm.durationMins && logForm.distanceMeters
                  ? fmtPace((Number(logForm.durationMins) * 60 / Number(logForm.distanceMeters)) * 100)
                  : "—"}{" "}
                /100m
              </div>
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {tab === "stats" && (
          <>
            <div className="grid-2 mb-6">
              <div className="card">
                <div className="section-title" style={{ marginBottom: 14 }}>Pace trend</div>
                <div className="bar-chart">
                  {paceData.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No data yet</div>
                  ) : (
                    paceData.map((a, i) => {
                      const height =
                        paceMax === paceMin
                          ? 50
                          : 20 + ((paceMax - a.avgPaceSecPer100!) / (paceMax - paceMin)) * 60;
                      const isBest = a.avgPaceSecPer100 === paceMin;
                      return (
                        <div
                          key={i}
                          className={`bar ${isBest ? "best" : ""}`}
                          style={{ height: `${height}px` }}
                          title={`${fmtPace(a.avgPaceSecPer100)}/100m`}
                        />
                      );
                    })
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  Last {paceData.length} sessions · taller = faster
                </div>
              </div>

              <div className="card">
                <div className="section-title" style={{ marginBottom: 14 }}>SWOLF trend</div>
                <div className="bar-chart">
                  {activities.filter((a) => a.avgSwolf).length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No data yet</div>
                  ) : (
                    activities
                      .filter((a) => a.avgSwolf)
                      .slice(0, 10)
                      .reverse()
                      .map((a, i) => {
                        const swolfArr = activities.filter((x) => x.avgSwolf).map((x) => x.avgSwolf!);
                        const mn = Math.min(...swolfArr), mx = Math.max(...swolfArr);
                        const height = mx === mn ? 50 : 20 + ((mx - a.avgSwolf!) / (mx - mn)) * 60;
                        const isBest = a.avgSwolf === mn;
                        return (
                          <div
                            key={i}
                            className={`bar ${isBest ? "best" : ""}`}
                            style={{
                              height: `${height}px`,
                              borderTopColor: "rgba(255,107,53,0.6)",
                              background: isBest ? "rgba(255,107,53,0.35)" : "rgba(255,107,53,0.15)",
                            }}
                            title={`SWOLF ${a.avgSwolf?.toFixed(1)}`}
                          />
                        );
                      })
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  Last sessions · taller = lower SWOLF = more efficient
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Volume by source</div>
              <div className="grid-3">
                {(["garmin", "apple_health", "strava", "manual", "fit_file"] as const).map((src) => {
                  const srcActivities = activities.filter((a) => a.source === src);
                  const dist = srcActivities.reduce((s, a) => s + a.distanceMeters, 0);
                  if (dist === 0) return null;
                  return (
                    <div key={src} className="card-sm">
                      <div className="stat-label">{src.replace("_", " ")}</div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
                        {(dist / 1000).toFixed(1)} km
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{srcActivities.length} sessions</div>
                    </div>
                  );
                })}
                {activities.length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", gridColumn: "1 / -1" }}>
                    No activities yet — load demo data to see volume breakdown.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
