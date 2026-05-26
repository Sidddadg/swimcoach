import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateWorkoutSummary } from "@/lib/ai/coach";
import { z } from "zod";

const CreateActivitySchema = z.object({
  userId: z.string(),
  name: z.string(),
  startedAt: z.string().datetime(),
  durationSecs: z.number().positive(),
  source: z.enum(["apple_health", "garmin", "samsung", "fitbit", "manual", "fit_file", "strava"]),
  poolLength: z.number().optional(),
  isOpenWater: z.boolean().default(false),
  strokeType: z.enum(["freestyle", "backstroke", "breaststroke", "butterfly", "im", "mixed"]).optional(),
  distanceMeters: z.number().positive(),
  avgPaceSecPer100: z.number().optional(),
  avgSwolf: z.number().optional(),
  avgHeartRate: z.number().optional(),
  maxHeartRate: z.number().optional(),
  calories: z.number().optional(),
  totalStrokes: z.number().optional(),
  rawData: z.record(z.unknown()).optional(),
  laps: z.array(z.object({
    lapNumber: z.number(),
    durationSecs: z.number(),
    distanceMeters: z.number(),
    strokeType: z.string().optional(),
    strokeCount: z.number().optional(),
    swolf: z.number().optional(),
    avgHeartRate: z.number().optional(),
    paceSecPer100: z.number().optional(),
  })).default([]),
  generateAiSummary: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const source = searchParams.get("source");

    const where = {
      ...(userId ? { userId } : {}),
      ...(source ? { source } : {}),
    };

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          laps: { orderBy: { lapNumber: "asc" } },
          user: { select: { id: true, name: true, avatarUrl: true } },
          kudos: { select: { userId: true } },
        },
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activity.count({ where }),
    ]);

    return NextResponse.json({ activities, total, limit, offset });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CreateActivitySchema.parse(body);

    const { laps, generateAiSummary, rawData, ...activityData } = data;

    const activity = await prisma.activity.create({
      data: {
        ...activityData,
        startedAt: new Date(activityData.startedAt),
        rawData: rawData ? JSON.stringify(rawData) : null,
        laps: {
          create: laps,
        },
      },
      include: { laps: true },
    });

    // Optionally generate AI summary async
    if (generateAiSummary && process.env.ANTHROPIC_API_KEY) {
      generateWorkoutSummary(activity.id)
        .then((summary) =>
          prisma.activity.update({
            where: { id: activity.id },
            data: { aiSummary: summary },
          })
        )
        .catch(console.error);
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
  }
}
