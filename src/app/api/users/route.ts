import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  bio: z.string().optional(),
  goal: z.string().optional(),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced", "elite"]).default("intermediate"),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const email = searchParams.get("email");

  try {
    if (id || email) {
      const user = await prisma.user.findUnique({
        where: id ? { id } : { email: email! },
        include: {
          _count: {
            select: {
              activities: true,
              followers: true,
              following: true,
            },
          },
        },
      });

      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json(user);
    }

    const users = await prisma.user.findMany({
      include: { _count: { select: { activities: true, followers: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CreateUserSchema.parse(body);

    const user = await prisma.user.create({ data });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 });

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
