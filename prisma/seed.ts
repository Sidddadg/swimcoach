/**
 * Seed script — populates the DB with realistic swim data for development.
 * Run with: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const STROKE_TYPES = ["freestyle", "backstroke", "breaststroke", "butterfly", "im", "mixed"] as const;
const SOURCES = ["apple_health", "garmin", "manual", "strava"] as const;

async function main() {
  console.log("🏊 Seeding SwimCoach database...");

  // Create users
  const alice = await prisma.user.upsert({
    where: { email: "alice@swim.co" },
    update: {},
    create: {
      email: "alice@swim.co",
      name: "Alice Chen",
      bio: "Masters swimmer, aiming for sub-60 100m freestyle",
      goal: "100m freestyle under 60 seconds",
      fitnessLevel: "advanced",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@swim.co" },
    update: {},
    create: {
      email: "bob@swim.co",
      name: "Bob Martinez",
      bio: "Triathlete, open water enthusiast",
      goal: "Complete a 1.9km open water swim in under 35 minutes",
      fitnessLevel: "intermediate",
    },
  });

  // Follow relationship
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: alice.id, followingId: bob.id } },
    update: {},
    create: { followerId: alice.id, followingId: bob.id },
  });

  // Create activities for Alice (last 30 days)
  const aliceActivities = [
    { daysBack: 1, distance: 2500, stroke: "freestyle", source: "garmin", swolf: 36.2, pace: 95 },
    { daysBack: 3, distance: 3000, stroke: "mixed", source: "garmin", swolf: 38.1, pace: 98 },
    { daysBack: 5, distance: 1500, stroke: "freestyle", source: "apple_health", swolf: 35.8, pace: 92 },
    { daysBack: 7, distance: 4000, stroke: "freestyle", source: "garmin", swolf: 37.4, pace: 96 },
    { daysBack: 10, distance: 2000, stroke: "backstroke", source: "manual", swolf: 42.0, pace: 110 },
    { daysBack: 12, distance: 3500, stroke: "freestyle", source: "garmin", swolf: 36.0, pace: 94 },
    { daysBack: 14, distance: 2500, stroke: "im", source: "apple_health", swolf: 44.5, pace: 115 },
    { daysBack: 18, distance: 3000, stroke: "freestyle", source: "strava", swolf: 37.8, pace: 97 },
    { daysBack: 21, distance: 2000, stroke: "freestyle", source: "garmin", swolf: 38.5, pace: 99 },
    { daysBack: 25, distance: 1000, stroke: "butterfly", source: "manual", swolf: 48.2, pace: 125 },
  ];

  for (const a of aliceActivities) {
    const durationSecs = (a.distance / 100) * a.pace;
    const laps = [];
    const lapDist = 50; // 50m pool
    const numLaps = a.distance / lapDist;

    for (let i = 0; i < numLaps; i++) {
      const lapPace = a.pace * (1 + randBetween(-0.05, 0.05));
      const lapDur = (lapDist / 100) * lapPace;
      const strokes = Math.round(randBetween(30, 42));
      laps.push({
        lapNumber: i + 1,
        durationSecs: lapDur,
        distanceMeters: lapDist,
        strokeType: a.stroke,
        strokeCount: strokes,
        swolf: lapDur / (lapDist / 50) + strokes / (lapDist / 50),
        avgHeartRate: Math.round(randBetween(130, 160)),
        paceSecPer100: (lapDur / lapDist) * 100,
      });
    }

    await prisma.activity.create({
      data: {
        userId: alice.id,
        name: `${a.stroke.charAt(0).toUpperCase() + a.stroke.slice(1)} session`,
        startedAt: daysAgo(a.daysBack),
        durationSecs,
        source: a.source,
        poolLength: 50,
        isOpenWater: false,
        strokeType: a.stroke,
        distanceMeters: a.distance,
        avgPaceSecPer100: a.pace,
        avgSwolf: a.swolf,
        avgHeartRate: Math.round(randBetween(135, 155)),
        maxHeartRate: Math.round(randBetween(160, 178)),
        calories: Math.round(durationSecs / 60 * 9),
        laps: { create: laps },
      },
    });
  }

  // Create activities for Bob (open water focus)
  const bobActivities = [
    { daysBack: 2, distance: 1900, isOpenWater: true, source: "garmin", pace: 110 },
    { daysBack: 6, distance: 3200, isOpenWater: false, source: "apple_health", pace: 108 },
    { daysBack: 9, distance: 1000, isOpenWater: false, source: "garmin", pace: 112 },
    { daysBack: 15, distance: 2500, isOpenWater: true, source: "strava", pace: 106 },
    { daysBack: 22, distance: 1500, isOpenWater: false, source: "garmin", pace: 115 },
  ];

  for (const a of bobActivities) {
    const durationSecs = (a.distance / 100) * a.pace;
    await prisma.activity.create({
      data: {
        userId: bob.id,
        name: a.isOpenWater ? "Open water swim" : "Pool session",
        startedAt: daysAgo(a.daysBack),
        durationSecs,
        source: a.source,
        poolLength: a.isOpenWater ? undefined : 25,
        isOpenWater: a.isOpenWater,
        strokeType: "freestyle",
        distanceMeters: a.distance,
        avgPaceSecPer100: a.pace,
        avgSwolf: randBetween(40, 50),
        avgHeartRate: Math.round(randBetween(140, 158)),
        maxHeartRate: Math.round(randBetween(165, 180)),
        calories: Math.round(durationSecs / 60 * 8),
        laps: { create: [] },
      },
    });
  }

  const counts = await prisma.activity.count();
  console.log(`✅ Seeded: ${counts} activities, 2 users`);
  console.log(`   Alice: ${alice.id}`);
  console.log(`   Bob: ${bob.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
