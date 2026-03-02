# Anaxi-Learn

## Getting Started

### Prerequisites
- Docker + Docker Compose
- Node.js 20+

### Local Development with Docker

```bash
# Start PostgreSQL and the Next.js app
docker compose up -d

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init

# Seed the database (KS3 Maths Number + FDP graph)
npx prisma db seed
# or: npm run db:seed

# Start the dev server (if not using Docker)
npm run dev
```

### Database Migrations

When the Prisma schema changes:

```bash
# Apply pending migrations
npx prisma migrate dev

# Regenerate the Prisma client
npx prisma generate
```

### Running Tests

```bash
npm test
```

### Environment Variables

Copy `.env.example` to `.env` and set:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anaxi_learn
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

## KS3 Maths Skill Graph

Stage 2 introduces a mastery-gated skill graph for KS3 Maths (Year 7 Entry).

- **56 skills** across Number (N1–N3) and FDP (N4) strands
- Prerequisite edges enforce unlock order: a skill is only available once all its prerequisites have `mastery ≥ 0.85` AND `confirmedCount ≥ 2`
- Spaced-repetition scheduler:
  - mastery < 0.6 → review in **1 day**
  - mastery ∈ [0.6, 0.85) → review in **3 days**
  - mastery ≥ 0.85 and confirmedCount < 2 → review in **7 days**
  - mastery ≥ 0.85 and confirmedCount ≥ 2 → review in **14 days**

