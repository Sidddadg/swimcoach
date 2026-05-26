/**
 * POST /api/sync
 *
 * Accepts normalized or raw swim data from any wearable source,
 * normalizes it using the appropriate adapter, and persists to the DB.
 *
 * Body shape:
 * {
 *   userId: string
 *   source: "apple_health" | "garmin" | "strava" | "fit_file" | "manual"
 *   data: <source-specific raw payload>
 *   generateAiSummary?: boolean
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeAppleHealth,
  normalizeGarmin,
  normalizeStrava,
  normalizeManual,
  normalizeFitFile,
  NormalizedSwimActivity,
} from "@/lib/swim/normalize";
import { generateWorkoutSummary } from "@/lib/ai/coach";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, source, data, generateAiSummary = false } = body;

    if (!userId || !source || !data) {
      return NextResponse.json(
        { error: "userId, source, and data are required" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Normalize based on source
    let normalized: NormalizedSwimActivity;

    switch (source) {
      case "apple_health":
        normalized = normalizeAppleHealth(data);
        break;
      case "garmin":
        normalized = normalizeGarmin(data);
        break;
      case "strava":
        normalized = normalizeStrava(data);
        break;
      case "fit_file":
        normalized = normalizeFitFile(data, data.__filename ?? "import.fit");
        break;
      case "manual":
        normalized = normalizeManual(data);
        break;
      default:
        return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
    }

    // Persist activity
    const activity = await prisma.activity.create({
      data: {
        userId,
        name: normalized.name,
        startedAt: normalized.startedAt,
        durationSecs: normalized.durationSecs,
        source: normalized.source,
        poolLength: normalized.poolLength,
        isOpenWater: normalized.isOpenWater,
        strokeType: normalized.strokeType,
        distanceMeters: normalized.distanceMeters,
        avgPaceSecPer100: normalized.avgPaceSecPer100,
        avgSwolf: normalized.avgSwolf,
        avgHeartRate: normalized.avgHeartRate,
        maxHeartRate: normalized.maxHeartRate,
        calories: normalized.calories,
        totalStrokes: normalized.totalStrokes,
        rawData: JSON.stringify(normalized.rawData),
        laps: {
          create: normalized.laps.map((l) => ({
            lapNumber: l.lapNumber,
            durationSecs: l.durationSecs,
            distanceMeters: l.distanceMeters,
            strokeType: l.strokeType,
            strokeCount: l.strokeCount,
            swolf: l.swolf,
            avgHeartRate: l.avgHeartRate,
            paceSecPer100: l.paceSecPer100,
          })),
        },
      },
      include: { laps: true },
    });

    // Generate AI summary in the background if requested
    if (generateAiSummary && process.env.ANTHROPIC_API_KEY) {
      generateWorkoutSummary(activity.id)
        .then((summary) =>
          prisma.activity.update({
            where: { id: activity.id },
            data: { aiSummary: summary },
          })
        )
        .catch((err) => console.error("AI summary failed:", err));
    }

    return NextResponse.json(
      {
        success: true,
        activityId: activity.id,
        normalized: {
          distance: activity.distanceMeters,
          duration: activity.durationSecs,
          pace: activity.avgPaceSecPer100,
          swolf: activity.avgSwolf,
          lapsImported: activity.laps.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

// GET /api/sync?userId=xxx — get sync status / last sync times per source
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const latestBySource = await prisma.$queryRaw<
      { source: string; lastSync: Date; count: bigint }[]
    >`
      SELECT source,
             MAX(startedAt) as lastSync,
             COUNT(*) as count
      FROM activities
      WHERE userId = ${userId}
      GROUP BY source
    `;

    return NextResponse.json({ sources: latestBySource });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to get sync status" }, { status: 500 });
  }
}
