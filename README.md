# WasteWise

**AI Powered Waste Management Platform**

A full-stack web application that gamifies waste reporting and collection through AI-powered verification, location-based reporting, and a token reward system.

---

## Overview

WasteWise transforms waste management into a community-driven, rewarding experience. Users report waste with photos and location data, collectors pick up verified reports, and both earn tokens through a transparent reward system. The platform uses Google's Gemini AI to automatically verify waste images, ensuring authenticity before collection.

**What makes it different:**
- AI-powered waste verification using Google Gemini
- Real-time location-based reporting with interactive maps
- Token economy rewarding both reporters and collectors
- Leaderboard and gamification to drive engagement
- Progressive Web App ready with offline-capable features

---

## Key Features

### Report Waste
- Upload waste photos with automatic AI verification via Gemini
- Detects waste type, quantity, and confidence level
- Identifies human/animal presence in images
- Interactive map for precise location selection (MapLibre GL)
- Anonymous submission supported
- View recent reports with status tracking

### Collect Waste
- Browse available collection tasks by area
- Search and filter tasks with pagination
- Status workflow: pending → in_progress → completed → verified
- Photo verification upon collection completion
- Earn 10-50 tokens per successful verification

### Rewards System
- Track your token balance and transaction history
- Browse available rewards catalog
- Redeem individual rewards or all points at once
- Transaction types: earned (reports), earned (collect), redeemed

### Leaderboard
- Real-time rankings sorted by points
- Top performers highlighted with crown badges
- Current user row emphasized
- Level progression display

### Notifications
- In-app notification center
- Mark notifications as read
- Type-based notification categories

### Carbon Calculator
- Estimate carbon emissions from waste types and quantities
- Environmental impact visualization

### AI Assistant
- Integrated chat widget powered by GPT Trainer
- Contextual help for waste management queries
- Floating chat interface with smooth animations

### Home Dashboard
- Animated 3D globe visualization (cobe library)
- Real-time impact metrics (waste collected, reports submitted, tokens earned, CO₂ offset)
- Quick action buttons for reporting and collecting

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14.2.16 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Database** | PostgreSQL via Supabase |
| **ORM** | Drizzle ORM |
| **Authentication** | Supabase Auth (email OTP / magic links) |
| **AI** | Google Generative AI (Gemini) |
| **Maps** | MapLibre GL + Leaflet |
| **Geocoding** | Nominatim OSM API |
| **Rate Limiting** | Upstash Redis (REST) |
| **Styling** | Tailwind CSS |
| **UI Components** | Radix UI primitives |
| **Animations** | Framer Motion |
| **Notifications** | React Hot Toast |
| **Deployment** | Docker (multi-stage), Vercel |

---

## Architecture

### Request Flow

```
Client Component
     ↓
Server Action (utils/db/action.ts)
     ↓
Drizzle ORM
     ↓
PostgreSQL (Supabase)
```

- All database operations run as server actions
- No client-side database access
- Client-side caching (30s TTL) with deduplication via `cachedCall()`

### Authentication Flow

```
Email Input
     ↓
signInWithOtp (Supabase Auth)
     ↓
Magic Link Email
     ↓
User Clicks Link
     ↓
Session Cookie Set (@supabase/ssr)
     ↓
onAuthStateChange (Header component)
     ↓
createUser Server Action
     ↓
Database User Created
```

- Cookie-based sessions managed by `@supabase/ssr`
- Middleware refreshes sessions on every request
- No route protection in middleware (all routes public)
- User email resolved from Supabase session

### Rate Limiting Strategy

```
API Request
     ↓
checkRateLimit (lib/rate-limit.ts)
     ↓
Redis INCR + EXPIRE (atomic)
     ↓
Allowed? → Continue → Gemini API
     ↓
Denied? → 429 Response with Retry-After
```

- **Dual rate limiting** on Gemini API:
  - Burst: 10 requests per 60 seconds
  - Hourly: 120 requests per 3600 seconds
- Fixed-window algorithm with atomic operations
- Fail-open by default (configurable to fail-closed)
- 2-second timeout on Redis operations

---

## Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts | id, email, name, createdAt |
| `reports` | Waste reports | userId, location, wasteType, amount, imageUrl, verificationResult, status, collectorId |
| `rewards` | User reward balances | userId, points, level, name, description |
| `collected_wastes` | Collection records | reportId, collectorId, collectionDate, status |
| `notifications` | User notifications | userId, message, type, isRead |
| `transactions` | Point history | userId, type, amount, description |

### Relationships

- `reports.userId` → `users.id` (nullable for anonymous reports)
- `reports.collectorId` → `users.id`
- `rewards.userId` → `users.id`
- `collected_wastes.reportId` → `reports.id`
- `collected_wastes.collectorId` → `users.id`
- `notifications.userId` → `users.id`
- `transactions.userId` → `users.id`

---

## Project Structure

```
my-app/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── gemini/route.ts       # Gemini AI endpoint (image + text)
│   │   └── geocode/route.ts      # Geocoding API (Nominatim)
│   ├── report/page.tsx           # Waste reporting page
│   ├── collect/page.tsx          # Collection tasks page
│   ├── rewards/page.tsx          # Rewards management page
│   ├── leaderboard/page.tsx      # User rankings
│   ├── calculator/page.tsx       # Carbon calculator
│   ├── page.tsx                  # Home page with globe
│   ├── metadata.tsx              # App metadata
│   └── layout.tsx                # Root layout
├── components/
│   ├── Header.tsx                # Navigation + auth + notifications
│   ├── ui/                       # shadcn/ui primitives
│   ├── MapLibreLocation.tsx      # Map picker component
│   └── PulsatingButton.tsx       # Animated CTA
├── utils/db/
│   ├── schema.ts                 # Drizzle schema definitions
│   └── action.ts                 # Server actions (all DB operations)
├── hooks/
│   ├── useClientCache.ts         # Client-side caching with TTL
│   └── useMediaQuery.ts          # Responsive breakpoint hook
├── lib/
│   ├── rate-limit.ts             # Redis rate limiter
│   ├── redis.ts                  # Upstash Redis client
│   └── supabase/
│       ├── client.ts             # Browser Supabase client
│       └── server.ts             # Server Supabase client
├── middleware.ts                 # Session refresh middleware
├── next.config.mjs               # Next.js configuration
├── Dockerfile                    # Multi-stage Docker build
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase recommended)
- Upstash Redis account (for rate limiting)
- Google AI Studio account (for Gemini API)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd my-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the project root:
   ```env
   # Database
   DATABASE_URL=your_postgresql_connection_string
   
   # Supabase Auth
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   
   # Gemini AI
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-3.6-flash
   
   # Upstash Redis (optional - rate limiting)
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   
   # Rate Limiting Configuration (optional)
   RATE_LIMIT_GEMINI_MAX=10
   RATE_LIMIT_GEMINI_WINDOW=60
   RATE_LIMIT_GEMINI_HOURLY_MAX=120
   RATE_LIMIT_GEMINI_HOURLY_WINDOW=3600
   RATE_LIMIT_STRICT=0
   ```

4. **Push database schema**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable (anon) key |
| `GEMINI_API_KEY` | Yes* | Google AI API key (server-side) |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Yes* | Google AI API key (client-side fallback) |
| `GEMINI_MODEL` | No | Gemini model ID (default: `gemini-3.6-flash`) |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token |
| `RATE_LIMIT_GEMINI_MAX` | No | Burst limit (default: 10) |
| `RATE_LIMIT_GEMINI_WINDOW` | No | Burst window in seconds (default: 60) |
| `RATE_LIMIT_GEMINI_HOURLY_MAX` | No | Hourly limit (default: 120) |
| `RATE_LIMIT_GEMINI_HOURLY_WINDOW` | No | Hourly window in seconds (default: 3600) |
| `RATE_LIMIT_STRICT` | No | Set to `1` to fail closed when Redis is down |

*At least one Gemini API key is required.

---

## Deployment

### Docker (Recommended)

The project includes a production-ready multi-stage Dockerfile:

```bash
# Build the image
docker build -t wastewise .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL=your_db_url \
  -e NEXT_PUBLIC_SUPABASE_URL=your_supabase_url \
  -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_key \
  -e GEMINI_API_KEY=your_gemini_key \
  wastewise
```

**Docker build arguments** (pass during build for client-side env vars):
```bash
docker build \
  --build-arg NEXT_PUBLIC_GEMINI_API_KEY=your_key \
  --build-arg NEXT_PUBLIC_GEMINI_MODEL=gemini-3.6-flash \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=your_url \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_key \
  -t wastewise .
```

**Dockerfile highlights:**
- Stage 1: Install production dependencies
- Stage 2: Build Next.js app with env vars
- Stage 3: Production runner with non-root user
- Standalone output for minimal image size
- Static assets and public files included

### Vercel

The project is configured for Vercel deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Configuration notes:**
- `output: 'standalone'` in `next.config.mjs`
- ESLint checks ignored during build (`ignoreDuringBuilds: true`)
- Server actions body size limit: 5MB

---

## Infrastructure Migration

### Web3Auth → Supabase Auth

The authentication system was migrated from Web3Auth to Supabase Auth:

**Previous (Web3Auth):**
- Wallet-based authentication
- Web3 identity management
- Complex client-side session handling

**Current (Supabase Auth):**
- Email OTP / magic link authentication
- Cookie-based sessions via `@supabase/ssr`
- Server-side session validation
- Simplified user management

**Migration highlights:**
- Removed all Web3 dependencies
- No wallet functionality remains
- Email-based user identification
- Automatic session refresh via middleware

---

## Security

### Authentication
- Email OTP with magic links (no passwords)
- HTTP-only cookie sessions
- Automatic session refresh
- No client-side token storage

### Rate Limiting
- Server-side rate limiting on Gemini API
- Dual limits (burst + hourly)
- IP-based identification
- Fail-open design with timeout protection

### Data Protection
- All DB operations through server actions
- No direct client-to-database access
- Image validation (type, size limits)
- Input sanitization on all forms

### Best Practices
- Non-root Docker user
- Minimal production dependencies
- Environment variable injection
- No secrets in client bundles

---

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Run linter
npm run lint

# Push schema changes to database
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio

# Verify database schema
npm run verify:db
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Code style:**
- TypeScript strict mode enabled
- Use `cn()` from `lib/utils.ts` for conditional Tailwind classes
- Prefer Radix UI primitives from `components/ui/`
- Follow existing component patterns

---

## License

This project is private and unlicensed.

---

## Author

**Jai Chawla**

---

## Acknowledgments

- [Supabase](https://supabase.com/) - Authentication and database
- [Google Gemini](https://ai.google.dev/) - AI-powered waste verification
- [MapLibre](https://maplibre.org/) - Open-source mapping
- [Upstash](https://upstash.com/) - Serverless Redis
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [Framer Motion](https://www.framer.com/motion/) - Animation library
