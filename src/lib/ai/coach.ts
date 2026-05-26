/**
 * AI Coaching Engine
 *
 * Builds rich context from a user's swim history and sends it to Claude
 * to generate personalized coaching advice, post-workout summaries,
 * and training plans.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/prisma";
import { formatPace, formatDuration } from "@/lib/swim/normalize";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const COACH_SYSTEM_PROMPT = `You are an elite swimming coach with decades of experience coaching athletes from beginner to Olympic level. You specialize in technique analysis, training periodization, and performance optimization.

Your coaching style is:
- Data-driven: you always reference specific metrics (SWOLF, pace per 100m, stroke rate, heart rate zones)
- Practical: you give specific, actionable advice — not generic tips
- Encouraging but honest: you celebrate progress while identifying areas for improvement
- Technical: you use proper swimming terminology (CSS, T-pace, aerobic threshold, taper, etc.)
- Personalized: every recommendation is tailored to this swimmer's history, goals, and fitness level

When analyzing workouts:
- Comment on SWOLF trends (lower = more efficient; 35-45 is good for recreational, <35 for competitive)
- Identify pace consistency across laps
- Note heart rate zone distribution
- Compare to the athlete's personal bests and recent trends

When building training plans:
- Use periodization principles (base → build → peak → taper)
- Prescribe specific sets with distances, rest intervals, and target paces
- Include all four strokes for IM training when appropriate
- Balance aerobic base (60-70%) with threshold (20-25%) and speed work (5-15%)

Always respond in a conversational coaching tone. Use line breaks to organize your thoughts. Keep responses focused and practical.`;

// ─── Context builder ───────────────────────────────────────────────────────────

async function buildSwimmerContext(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      activities: {
        orderBy: { startedAt: "desc" },
        take: 20,
        include: { laps: true },
      },
    },
  });

  if (!user) {
    return `=== SWIMMER PROFILE ===
No profile on file yet. The swimmer is just getting started.
Total sessions logged: 0
Total distance: 0 km

Encourage them to log their first swim and load demo data to see what insights look like.`.trim();
  }

  const recentActivities = user.activities.slice(0, 10);
  const allActivities = user.activities;

  // Compute aggregates
  const totalDistanceKm = allActivities.reduce((s, a) => s + a.distanceMeters, 0) / 1000;
  const totalSessions = allActivities.length;
  const avgPace = recentActivities
    .filter((a) => a.avgPaceSecPer100)
    .map((a) => a.avgPaceSecPer100!);
  const avgRecentPace = avgPace.length
    ? avgPace.reduce((s, p) => s + p, 0) / avgPace.length
    : null;

  const bestPace = allActivities
    .filter((a) => a.avgPaceSecPer100)
    .sort((a, b) => (a.avgPaceSecPer100 ?? 999) - (b.avgPaceSecPer100 ?? 999))[0];

  // Weekly volume (last 4 weeks)
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const recentWeeks = allActivities.filter((a) => a.startedAt >= fourWeeksAgo);
  const weeklyDistanceKm = recentWeeks.reduce((s, a) => s + a.distanceMeters, 0) / 1000 / 4;

  const recentSummary = recentActivities
    .slice(0, 5)
    .map((a) => {
      const lapInfo =
        a.laps.length > 0
          ? `  Laps: ${a.laps
              .map((l) => `${l.distanceMeters}m in ${formatDuration(l.durationSecs)} (SWOLF: ${l.swolf?.toFixed(1) ?? "n/a"})`)
              .join(", ")}`
          : "";
      return `• ${a.startedAt.toDateString()} — ${a.distanceMeters}m ${a.strokeType ?? "mixed"} | Pace: ${formatPace(a.avgPaceSecPer100)} | SWOLF: ${a.avgSwolf?.toFixed(1) ?? "n/a"} | Duration: ${formatDuration(a.durationSecs)} | Source: ${a.source}${lapInfo ? "\n" + lapInfo : ""}`;
    })
    .join("\n");

  return `
=== SWIMMER PROFILE ===
Name: ${user.name}
Goal: ${user.goal ?? "Not set"}
Fitness level: ${user.fitnessLevel}
Total sessions logged: ${totalSessions}
Total distance: ${totalDistanceKm.toFixed(1)} km
Avg weekly volume (last 4 weeks): ${weeklyDistanceKm.toFixed(1)} km/week
Best pace on record: ${bestPace ? formatPace(bestPace.avgPaceSecPer100) : "n/a"}
Recent avg pace: ${avgRecentPace ? formatPace(avgRecentPace) : "n/a"}

=== LAST 5 SESSIONS ===
${recentSummary || "No recent sessions."}
`.trim();
}

// ─── Post-workout AI summary ───────────────────────────────────────────────────

export async function generateWorkoutSummary(activityId: string): Promise<string> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { laps: true, user: true },
  });

  if (!activity) return "Activity not found.";

  const lapDetail =
    activity.laps.length > 0
      ? activity.laps
          .map(
            (l) =>
              `Lap ${l.lapNumber}: ${l.distanceMeters}m, ${formatDuration(l.durationSecs)}, SWOLF ${l.swolf?.toFixed(1) ?? "n/a"}, pace ${formatPace(l.paceSecPer100)}`
          )
          .join("\n")
      : "No lap data available.";

  const prompt = `Analyze this swim workout and provide a concise post-workout summary (3-4 paragraphs).
Focus on: what went well, efficiency trends (SWOLF), pacing consistency, and one key recommendation for the next session.

WORKOUT DATA:
Distance: ${activity.distanceMeters}m
Duration: ${formatDuration(activity.durationSecs)}
Stroke: ${activity.strokeType ?? "mixed"}
Avg pace: ${formatPace(activity.avgPaceSecPer100)}
Avg SWOLF: ${activity.avgSwolf?.toFixed(1) ?? "n/a"}
Avg HR: ${activity.avgHeartRate ?? "n/a"} bpm
Pool length: ${activity.poolLength ?? "open water"}m
Source: ${activity.source}

LAP BREAKDOWN:
${lapDetail}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ─── Coach chat ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chatWithCoach(
  userId: string,
  messages: ChatMessage[]
): Promise<string> {
  const swimmerContext = await buildSwimmerContext(userId);

  const systemWithContext = `${COACH_SYSTEM_PROMPT}

${swimmerContext}

Use the swimmer's data above to give personalized, specific advice. Reference their actual numbers.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: systemWithContext,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ─── Training plan generator ───────────────────────────────────────────────────

export async function generateTrainingPlan(
  userId: string,
  goalDescription: string,
  weeksOut: number
): Promise<string> {
  const swimmerContext = await buildSwimmerContext(userId);

  const prompt = `Generate a detailed ${weeksOut}-week training plan for this swimmer.

Goal: ${goalDescription}
Weeks until goal event: ${weeksOut}

${swimmerContext}

Format the plan as:
- Week-by-week structure with volume and focus
- 3-4 specific example sessions per week with full set descriptions
- Include target paces (expressed as /100m times or as % of CSS pace)
- Note taper if applicable in the final 1-2 weeks`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
