import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 40px",
          height: 60,
          borderBottom: "1px solid var(--border)",
          background: "rgba(10, 37, 64, 0.85)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 800,
            color: "var(--accent)",
            letterSpacing: "-0.02em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          🌊 <span style={{ color: "var(--text-primary)" }}>Swim</span>Coach
        </span>
        <div style={{ flex: 1 }} />
        <Link
          href="/dashboard"
          style={{
            background: "var(--accent)",
            color: "var(--pool)",
            borderRadius: 8,
            padding: "8px 18px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Open Dashboard →
        </Link>
      </header>

      {/* Hero */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px 24px 64px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0,212,255,0.1)",
            border: "1px solid rgba(0,212,255,0.25)",
            borderRadius: 20,
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          Powered by Claude AI
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(40px, 7vw, 72px)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 20,
            maxWidth: 700,
          }}
        >
          Train smarter,{" "}
          <span style={{ color: "var(--accent)" }}>swim faster</span>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "var(--text-secondary)",
            maxWidth: 520,
            lineHeight: 1.7,
            marginBottom: 40,
          }}
        >
          AI-powered swim coaching. Track every meter, analyze your efficiency, and get personalized coaching from Claude — all in one place.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/dashboard"
            style={{
              background: "var(--accent)",
              color: "var(--pool)",
              borderRadius: 10,
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Open Dashboard →
          </Link>
          <a
            href="https://github.com"
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              borderRadius: 10,
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid var(--border-strong)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            View source
          </a>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "64px 40px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 48,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 10,
            }}
          >
            Everything you need to level up
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
            From raw data ingestion to AI-generated training plans
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[
            {
              icon: "📋",
              title: "Activity Feed",
              desc: "Every swim in one place — laps, SWOLF, pace, heart rate. Sync from Garmin, Apple Health, Strava, or log manually.",
            },
            {
              icon: "🤖",
              title: "AI Swim Coach",
              desc: "Claude analyzes your history and gives personalized advice on pacing, technique, and training plans — not generic tips.",
            },
            {
              icon: "📊",
              title: "Smart Analytics",
              desc: "Pace trend charts, SWOLF efficiency tracking, and volume breakdowns across all your connected data sources.",
            },
            {
              icon: "⌚",
              title: "Multi-source Sync",
              desc: "Unified data model normalizes workouts from any wearable: Garmin, Apple Health, Strava, FIT files, and manual entry.",
            },
            {
              icon: "🏊",
              title: "Lap Breakdown",
              desc: "Per-lap SWOLF, pace, and heart rate. Spot where you faded or surged across any session.",
            },
            {
              icon: "🗓️",
              title: "Training Plans",
              desc: "Tell the coach your goal. Get a periodized 4-16 week plan with specific sets, distances, and target paces.",
            },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "24px",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                }}
              >
                {f.title}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        style={{
          padding: "64px 40px",
          borderTop: "1px solid var(--border)",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 800,
            color: "var(--text-primary)",
            textAlign: "center",
            marginBottom: 48,
          }}
        >
          How it works
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
          {[
            { step: "01", title: "Connect your data", desc: "Sync from Garmin, Apple Health, Strava, or log swims manually via the dashboard." },
            { step: "02", title: "Track every meter", desc: "Your sessions are stored with full lap data, SWOLF, pace, and heart rate metrics." },
            { step: "03", title: "Get coached by AI", desc: "Claude reads your history and delivers personalized feedback, plans, and insights." },
          ].map((s) => (
            <div key={s.step} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--accent)",
                  letterSpacing: "0.1em",
                }}
              >
                {s.step}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {s.title}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: "64px 40px",
          textAlign: "center",
          borderTop: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Ready to swim smarter?
        </h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 15 }}>
          Open the dashboard and load demo data to try it instantly — no account needed.
        </p>
        <Link
          href="/dashboard"
          style={{
            background: "var(--accent)",
            color: "var(--pool)",
            borderRadius: 10,
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Open Dashboard →
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "20px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          🌊 SwimCoach — Built with Next.js · Prisma · Claude AI
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          {["Next.js 14", "Prisma", "Claude AI", "Vercel"].map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--text-muted)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "3px 8px",
                fontFamily: "var(--font-mono)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
