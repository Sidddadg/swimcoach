/**
 * Swim data normalization layer.
 *
 * Each wearable platform exports data in different formats.
 * This module normalizes all of them into a single SwimActivity schema
 * that the rest of the app uses.
 */

export type StrokeType =
  | "freestyle"
  | "backstroke"
  | "breaststroke"
  | "butterfly"
  | "im"
  | "mixed"
  | "unknown";

export interface NormalizedLap {
  lapNumber: number;
  durationSecs: number;
  distanceMeters: number;
  strokeType?: StrokeType;
  strokeCount?: number;
  swolf?: number;
  avgHeartRate?: number;
  paceSecPer100?: number;
}

export interface NormalizedSwimActivity {
  name: string;
  startedAt: Date;
  durationSecs: number;
  source: string;
  poolLength?: number;        // 25 | 50 | undefined (open water)
  isOpenWater: boolean;
  strokeType?: StrokeType;
  distanceMeters: number;
  avgPaceSecPer100?: number;
  avgSwolf?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  totalStrokes?: number;
  rawData: Record<string, unknown>;
  laps: NormalizedLap[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcPaceSecPer100(durationSecs: number, distanceMeters: number): number | undefined {
  if (!distanceMeters || distanceMeters === 0) return undefined;
  return (durationSecs / distanceMeters) * 100;
}

export function calcSwolf(durationSecs: number, strokeCount: number, distanceMeters: number, poolLength = 25): number {
  const lengths = distanceMeters / poolLength;
  if (lengths === 0) return 0;
  const secsPerLength = durationSecs / lengths;
  const strokesPerLength = strokeCount / lengths;
  return secsPerLength + strokesPerLength;
}

function garminStrokeToStrokeType(garminStroke?: string): StrokeType {
  const map: Record<string, StrokeType> = {
    freestyle: "freestyle",
    backstroke: "backstroke",
    breaststroke: "breaststroke",
    butterfly: "butterfly",
    mixed: "mixed",
    drill: "freestyle",
  };
  return garminStroke ? (map[garminStroke.toLowerCase()] ?? "unknown") : "unknown";
}

// ─── Apple HealthKit ───────────────────────────────────────────────────────────

export interface AppleHealthSwimWorkout {
  startDate: string;
  endDate: string;
  duration: number;           // seconds
  totalDistance: number;      // meters
  totalEnergyBurned?: number;
  lapLength?: number;         // meters (pool length)
  strokeStyle?: string;
  laps?: Array<{
    startDate: string;
    endDate: string;
    strokeCount: number;
    distance: number;
  }>;
  heartRate?: {
    average?: number;
    max?: number;
  };
}

export function normalizeAppleHealth(raw: AppleHealthSwimWorkout): NormalizedSwimActivity {
  const durationSecs = raw.duration;
  const distanceMeters = raw.totalDistance;

  const laps: NormalizedLap[] = (raw.laps ?? []).map((l, i) => {
    const lapDuration = (new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / 1000;
    const swolf = raw.lapLength
      ? calcSwolf(lapDuration, l.strokeCount, l.distance, raw.lapLength)
      : undefined;
    return {
      lapNumber: i + 1,
      durationSecs: lapDuration,
      distanceMeters: l.distance,
      strokeCount: l.strokeCount,
      swolf,
      paceSecPer100: calcPaceSecPer100(lapDuration, l.distance),
    };
  });

  const totalStrokes = laps.reduce((sum, l) => sum + (l.strokeCount ?? 0), 0);
  const avgSwolf = laps.length > 0
    ? laps.reduce((sum, l) => sum + (l.swolf ?? 0), 0) / laps.filter(l => l.swolf != null).length
    : undefined;

  return {
    name: "Swim workout",
    startedAt: new Date(raw.startDate),
    durationSecs,
    source: "apple_health",
    poolLength: raw.lapLength,
    isOpenWater: !raw.lapLength,
    distanceMeters,
    avgPaceSecPer100: calcPaceSecPer100(durationSecs, distanceMeters),
    avgSwolf,
    avgHeartRate: raw.heartRate?.average,
    maxHeartRate: raw.heartRate?.max,
    calories: raw.totalEnergyBurned,
    totalStrokes: totalStrokes || undefined,
    rawData: raw as unknown as Record<string, unknown>,
    laps,
  };
}

// ─── Garmin Connect API ────────────────────────────────────────────────────────

export interface GarminSwimActivity {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  duration: number;             // seconds
  distance: number;             // meters
  poolLength: number;           // meters
  avgStrokeDistance?: number;
  avgSwolf?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  primaryStrokeType?: string;
  splitSummaries?: Array<{
    distance: number;
    duration: number;
    strokeType: string;
    numberOfStrokes: number;
    avgSwolf: number;
    avgHeartRate?: number;
  }>;
}

export function normalizeGarmin(raw: GarminSwimActivity): NormalizedSwimActivity {
  const laps: NormalizedLap[] = (raw.splitSummaries ?? []).map((s, i) => ({
    lapNumber: i + 1,
    durationSecs: s.duration,
    distanceMeters: s.distance,
    strokeType: garminStrokeToStrokeType(s.strokeType),
    strokeCount: s.numberOfStrokes,
    swolf: s.avgSwolf,
    avgHeartRate: s.avgHeartRate,
    paceSecPer100: calcPaceSecPer100(s.duration, s.distance),
  }));

  return {
    name: raw.activityName,
    startedAt: new Date(raw.startTimeLocal),
    durationSecs: raw.duration,
    source: "garmin",
    poolLength: raw.poolLength,
    isOpenWater: !raw.poolLength,
    strokeType: garminStrokeToStrokeType(raw.primaryStrokeType),
    distanceMeters: raw.distance,
    avgPaceSecPer100: calcPaceSecPer100(raw.duration, raw.distance),
    avgSwolf: raw.avgSwolf,
    avgHeartRate: raw.avgHeartRate,
    maxHeartRate: raw.maxHeartRate,
    calories: raw.calories,
    rawData: raw as unknown as Record<string, unknown>,
    laps,
  };
}

// ─── FIT File (Garmin / generic device) ───────────────────────────────────────

// fit-parser returns an object like { activity: { sessions: [...], laps: [...], records: [...] } }
// This normalizer handles the parsed output.
export function normalizeFitFile(parsed: Record<string, unknown>, filename: string): NormalizedSwimActivity {
  const activity = parsed.activity as Record<string, unknown> ?? {};
  const sessions = (activity.sessions as Record<string, unknown>[]) ?? [];
  const session = sessions[0] ?? {};
  const rawLaps = (activity.laps as Record<string, unknown>[]) ?? [];

  const durationSecs = (session.total_elapsed_time as number) ?? 0;
  const distanceMeters = (session.total_distance as number) ?? 0;
  const poolLength = (session.pool_length as number) ?? 25;

  const laps: NormalizedLap[] = rawLaps.map((l, i) => {
    const dur = (l.total_elapsed_time as number) ?? 0;
    const dist = (l.total_distance as number) ?? 0;
    const strokes = (l.total_strokes as number) ?? 0;
    return {
      lapNumber: i + 1,
      durationSecs: dur,
      distanceMeters: dist,
      strokeType: garminStrokeToStrokeType(l.swim_stroke as string),
      strokeCount: strokes,
      swolf: strokes && poolLength ? calcSwolf(dur, strokes, dist, poolLength) : undefined,
      avgHeartRate: l.avg_heart_rate as number,
      paceSecPer100: calcPaceSecPer100(dur, dist),
    };
  });

  return {
    name: filename.replace(/\.fit$/i, "") || "FIT import",
    startedAt: new Date((session.start_time as string) ?? Date.now()),
    durationSecs,
    source: "fit_file",
    poolLength,
    isOpenWater: false,
    distanceMeters,
    avgPaceSecPer100: calcPaceSecPer100(durationSecs, distanceMeters),
    avgHeartRate: session.avg_heart_rate as number,
    maxHeartRate: session.max_heart_rate as number,
    calories: session.total_calories as number,
    rawData: parsed,
    laps,
  };
}

// ─── Strava API ────────────────────────────────────────────────────────────────

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string;
  elapsed_time: number;
  distance: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  pool_length?: number;
  laps?: Array<{
    elapsed_time: number;
    distance: number;
    average_heartrate?: number;
  }>;
}

export function normalizeStrava(raw: StravaActivity): NormalizedSwimActivity {
  const laps: NormalizedLap[] = (raw.laps ?? []).map((l, i) => ({
    lapNumber: i + 1,
    durationSecs: l.elapsed_time,
    distanceMeters: l.distance,
    avgHeartRate: l.average_heartrate,
    paceSecPer100: calcPaceSecPer100(l.elapsed_time, l.distance),
  }));

  return {
    name: raw.name,
    startedAt: new Date(raw.start_date),
    durationSecs: raw.elapsed_time,
    source: "strava",
    poolLength: raw.pool_length,
    isOpenWater: !raw.pool_length,
    distanceMeters: raw.distance,
    avgPaceSecPer100: calcPaceSecPer100(raw.elapsed_time, raw.distance),
    avgHeartRate: raw.average_heartrate,
    maxHeartRate: raw.max_heartrate,
    calories: raw.calories,
    rawData: raw as unknown as Record<string, unknown>,
    laps,
  };
}

// ─── Manual entry ─────────────────────────────────────────────────────────────

export interface ManualSwimEntry {
  name?: string;
  date: string;
  durationMins: number;
  distanceMeters: number;
  poolLength?: number;
  strokeType?: StrokeType;
  avgHeartRate?: number;
  notes?: string;
}

export function normalizeManual(raw: ManualSwimEntry): NormalizedSwimActivity {
  const durationSecs = raw.durationMins * 60;
  return {
    name: raw.name ?? "Manual swim",
    startedAt: new Date(raw.date),
    durationSecs,
    source: "manual",
    poolLength: raw.poolLength,
    isOpenWater: !raw.poolLength,
    strokeType: raw.strokeType,
    distanceMeters: raw.distanceMeters,
    avgPaceSecPer100: calcPaceSecPer100(durationSecs, raw.distanceMeters),
    rawData: raw as unknown as Record<string, unknown>,
    laps: [],
  };
}

// ─── Format helpers ────────────────────────────────────────────────────────────

export function formatPace(secsPerHundred?: number | null): string {
  if (!secsPerHundred) return "—";
  const mins = Math.floor(secsPerHundred / 60);
  const secs = Math.round(secsPerHundred % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/100m`;
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
