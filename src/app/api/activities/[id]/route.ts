import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateWorkoutSummary } from "@/lib/ai/coach";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: params.id },
      include: {
        laps: { orderBy: { lapNumber: "asc" } },
        user: { select: { id: true, name: true, avatarUrl: true } },
        kudos: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    return NextResponse.json(activity);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    // Handle AI summary generation on demand
    if (body.generateAiSummary) {
      const summary = await generateWorkoutSummary(params.id);
      const updated = await prisma.activity.update({
        where: { id: params.id },
        data: { aiSummary: summary },
        include: { laps: true },
      });
      return NextResponse.json(updated);
    }

    const { laps: _laps, ...updateData } = body;

    const updated = await prisma.activity.update({
      where: { id: params.id },
      data: updateData,
      include: { laps: { orderBy: { lapNumber: "asc" } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.activity.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete activity" }, { status: 500 });
  }
}
