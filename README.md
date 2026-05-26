# 🌊 SwimCoach — AI-Powered Swim Training Platform

A **Strava for swimming** with a Claude-powered AI coaching engine. Built with Next.js 14, Prisma, and the Anthropic API.

---

## Architecture

```
swimcoach/
├── prisma/
│   ├── schema.prisma        # DB schema (User, Activity, Lap, Follow, Kudo, CoachMessage)
│   └── seed.ts              # Demo data seeder
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── activities/  # GET/POST activities + [id] GET/PATCH/DELETE
│   │   │   ├── users/       # GET/POST/PATCH users
│   │   │   ├── coach/       # POST chat + training plans, GET history
│   │   │   └── sync/        # POST ingest from any wearable source
│   │   ├── dashboard/       # Main UI (feed, coach chat, log swim, analytics)
│   │   └── globals.css      # Design system
│   └── lib/
│       ├── db/prisma.ts     # Prisma singleton
│       ├── swim/normalize.ts  # Wearable data normalization (Apple, Garmin, Strava, FIT, manual)
│       └── ai/coach.ts      # Claude coaching engine (chat, summaries, training plans)
```

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Create the database

```bash
npm run db:push    # Creates SQLite DB from schema
npm run db:seed    # Populates demo swim data
```

### 4. Run the dev server

```bash
npm run dev
# Open http://localhost:3000
```

---

## API Reference

### Activities

```
GET  /api/activities              List activities (query: userId, limit, offset, source)
POST /api/activities              Create activity (with optional AI summary generation)
GET  /api/activities/:id          Get single activity with laps + kudos
PATCH /api/activities/:id         Update activity; pass {generateAiSummary: true} to trigger AI
DELETE /api/activities/:id        Delete activity
```

### Sync (wearable ingestion)

```
POST /api/sync                    Ingest from any source; auto-normalizes to unified schema

Body: {
  userId: string
  source: "apple_health" | "garmin" | "strava" | "fit_file" | "manual"
  data: <source-specific raw payload>   // see normalize.ts for each format
  generateAiSummary?: boolean
}
```

**Example — sync a Garmin activity:**
```json
{
  "userId": "clxxx",
  "source": "garmin",
  "data": {
    "activityName": "Morning swim",
    "startTimeLocal": "2024-06-01T07:00:00",
    "duration": 3600,
    "distance": 3000,
    "poolLength": 50,
    "avgSwolf": 36.4,
    "avgHeartRate": 148,
    "primaryStrokeType": "freestyle",
    "splitSummaries": [...]
  },
  "generateAiSummary": true
}
```

**Example — sync Apple HealthKit data:**
```json
{
  "userId": "clxxx",
  "source": "apple_health",
  "data": {
    "startDate": "2024-06-01T07:00:00Z",
    "endDate": "2024-06-01T08:00:00Z",
    "duration": 3600,
    "totalDistance": 2500,
    "lapLength": 25,
    "heartRate": { "average": 145, "max": 168 },
    "laps": [...]
  }
}
```

### AI Coach

```
POST /api/coach                   Chat with the AI coach
POST /api/coach (mode: "plan")    Generate a training plan
GET  /api/coach?userId=xxx        Fetch message history
```

**Chat example:**
```json
{
  "userId": "clxxx",
  "message": "My SWOLF has been around 38 — how do I improve it?",
  "history": []
}
```

**Training plan example:**
```json
{
  "mode": "plan",
  "userId": "clxxx",
  "goalDescription": "100m freestyle under 60 seconds",
  "weeksOut": 8
}
```

### Users

```
GET  /api/users                   List all users
GET  /api/users?id=xxx            Get single user with counts
GET  /api/users?email=xxx         Get user by email
POST /api/users                   Create user
PATCH /api/users                  Update user (send id in body)
```

---

## Wearable integration guide

### Apple HealthKit (iOS native)

Use [`react-native-health`](https://github.com/agencyenterprise/react-native-health) or `HealthKitReporter` in a React Native / Expo app.

```typescript
import AppleHealthKit from 'react-native-health';

const options = {
  permissions: {
    read: [AppleHealthKit.Constants.Permissions.Swimming],
  },
};

AppleHealthKit.initHealthKit(options, () => {
  AppleHealthKit.getSamples(
    { type: 'Swimming', startDate: '2024-01-01T00:00:00.000Z' },
    async (err, results) => {
      await fetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ userId, source: 'apple_health', data: results[0] }),
      });
    }
  );
});
```

### Garmin Connect API

Garmin requires a **partner API key** (apply at https://developer.garmin.com).
For development, use [`python-garminconnect`](https://github.com/cyberjunky/python-garminconnect) which reverse-engineers the Connect web API.

```python
from garminconnect import Garmin

api = Garmin("email", "password")
api.login()
activities = api.get_activities_by_date("2024-01-01", "2024-12-31", "lap_swimming")

for activity in activities:
    detail = api.get_activity(activity['activityId'])
    # POST to /api/sync with source: "garmin"
```

### FIT file parsing

```typescript
import FitParser from 'fit-parser';

const fitParser = new FitParser({ force: true, speedUnit: 'm/s', lengthUnit: 'm' });

fitParser.parse(fitFileBuffer, (error, data) => {
  if (!error) {
    fetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        source: 'fit_file',
        data: { ...data, __filename: 'workout.fit' }
      })
    });
  }
});
```

### Strava API

```typescript
// After OAuth, exchange code for access token, then:
const activities = await fetch(
  'https://www.strava.com/api/v3/athlete/activities?per_page=50',
  { headers: { Authorization: `Bearer ${accessToken}` } }
).then(r => r.json());

for (const activity of activities.filter(a => a.type === 'Swim')) {
  await fetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ userId, source: 'strava', data: activity })
  });
}
```

---

## Key swim metrics explained

| Metric | Description | Good range |
|--------|-------------|------------|
| **SWOLF** | Strokes per length + seconds per length. Lower = more efficient | <35 competitive, 35-45 recreational |
| **Pace /100m** | Time to swim 100 meters. Core performance metric | Varies by stroke; 60-90s recreational freestyle |
| **CSS (Critical Swim Speed)** | Anaerobic threshold pace — max sustainable speed | Use for interval training targets |
| **DPS (Distance per Stroke)** | Meters traveled per stroke cycle. Higher = better technique | 1.8-2.5m elite freestylers |

---

## Next steps to build out

- [ ] **Auth** — Add NextAuth.js with email/Google OAuth
- [ ] **Wearable OAuth flows** — Garmin, Strava, Fitbit OAuth in dedicated `/api/auth/[provider]` routes
- [ ] **Real-time sync webhooks** — Garmin and Strava both offer activity webhooks
- [ ] **Pool segment leaderboards** — Strava-style segments for specific pool lanes
- [ ] **Social features** — Kudos, comments, club challenges
- [ ] **Mobile app** — React Native + Expo using the same API
- [ ] **Postgres + TimescaleDB** — Swap SQLite for production; TimescaleDB for efficient time-series queries
- [ ] **Streaming AI responses** — Use Vercel AI SDK for streaming coach chat
- [ ] **Training load analytics** — ATL/CTL/TSB charts (acute/chronic training load)
- [ ] **CSS calculator** — Compute Critical Swim Speed from 400m + 200m time trial

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 App Router |
| Database | SQLite via Prisma (→ swap to Postgres for prod) |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Validation | Zod |
| FIT files | fit-parser |
| Styling | CSS Modules with custom design system |
