import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { chatWithCoach, generateTrainingPlan } from "@/lib/ai/coach";
import { z } from "zod";

const ChatSchema = z.object({
  userId: z.string(),
  message: z.string().min(1),
  // Optionally send previous messages for context
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).default([]),
});

const PlanSchema = z.object({
  userId: z.string(),
  goalDescription: z.string(),
  weeksOut: z.number().int().positive().max(52),
});

// POST /api/coach — send a message to the AI coach
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Training plan mode
    if (body.mode === "plan") {
      const { userId, goalDescription, weeksOut } = PlanSchema.parse(body);
      const plan = await generateTrainingPlan(userId, goalDescription, weeksOut);
      return NextResponse.json({ plan });
    }

    // Chat mode (default)
    const { userId, message, history } = ChatSchema.parse(body);

    const messages = [
      ...history,
      { role: "user" as const, content: message },
    ];

    const reply = await chatWithCoach(userId, messages);

    // Persist the exchange
    await prisma.coachMessage.createMany({
      data: [
        { userId, role: "user", content: message },
        { userId, role: "assistant", content: reply },
      ],
    });

    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Coach unavailable" }, { status: 500 });
  }
}

// GET /api/coach?userId=xxx — fetch coach message history
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const messages = await prisma.coachMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({ messages });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
