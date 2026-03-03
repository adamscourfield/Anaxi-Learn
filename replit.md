# Anaxi Learn

## Project Overview
Adaptive mastery learning platform built for students. Features a KS3 Maths skill graph with 58 skills, spaced-repetition scheduling, and mastery gating.

## Tech Stack
- **Framework**: Next.js 15 (App Router) with TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js v4
- **Styling**: Tailwind CSS
- **Testing**: Vitest

## Project Structure
```
src/
  app/           # Next.js App Router pages and API routes
  contracts/     # TypeScript event contracts
  db/            # Prisma client setup
  middleware.ts  # Auth middleware
  __tests__/     # Vitest tests
prisma/
  schema.prisma  # Database schema
  migrations/    # SQL migrations
  seed.ts        # Database seeder
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `NEXTAUTH_SECRET` - NextAuth secret key
- `NEXTAUTH_URL` - NextAuth base URL (set to http://localhost:5000 for dev)

## Running the App
- Dev server: `npm run dev -- -p 5000 -H 0.0.0.0`
- Port: 5000

## Database Setup
- Schema managed via Prisma
- Use `npx prisma db push` to sync schema (fresh DB)
- Use `npm run db:seed` to seed with KS3 Maths data

## Key Routes
- `/` - Home / landing page
- `/login` - Login page
- `/diagnostic/ks3-maths` - Adaptive diagnostic assessment
- `/learn/ks3-maths` - Practice sessions with mastery gating
- `/admin/insight/ks3-maths` - Admin insight dashboard
- `/admin/interventions` - Intervention flags (admin only)

## Demo Accounts (from seed)
- Admin: `admin@anaxi.local` / `admin123`
- Student: `student@example.com` / `password123`
