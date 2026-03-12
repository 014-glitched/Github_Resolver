# GitHubResolver — Project Setup Documentation

## Project Overview

GitHubResolver is an AI-powered application that connects to a user's GitHub account, detects errors in Pull Requests (merge conflicts, CI failures, code errors), and automatically resolves them by generating a fix and opening a new PR — all via a background job powered by Claude AI.

---

## Final Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (App Router) | UI, routing, server components |
| Data Fetching | TanStack Query | Caching, polling, optimistic updates |
| Styling | Tailwind CSS | Utility-first styling |
| Auth | Better Auth | GitHub OAuth, session management |
| ORM | Prisma ORM | Type-safe database queries |
| Database | PostgreSQL via Neon | Primary database |
| Job Queue | BullMQ + Redis (Upstash) | Background AI resolution jobs |
| AI | Anthropic SDK (claude-sonnet-4) | Bug analysis and patch generation |
| GitHub API | Octokit SDK | Webhooks, branches, PRs |
| Deployment | Vercel + Neon + Upstash | Production infrastructure |

---

## Why This Stack?

### Next.js over Microservices
Microservices add infra overhead (Docker, inter-service auth, multiple repos) before shipping v1. Next.js keeps everything in one repo with shared TypeScript types, one deploy, and zero CORS issues.

### TanStack Query
Not an alternative to Next.js — it works alongside it. Handles client-side caching, polling for job progress, and optimistic updates. Especially useful for polling the AI resolution job status every few seconds.

### Prisma over Supabase client
Prisma gives cleaner, fully type-safe queries and keeps the GitHub access token directly in your own `User` table — critical for this project since the token is the core of the product.

### Neon over Supabase DB
No DB pausing on free tier, built-in connection pooling for serverless, and DB branching (like git branches for your database — great for testing).

### Better Auth over NextAuth
Simpler setup, better Next.js App Router support, and GitHub access tokens are stored cleanly in your own schema via Prisma adapter.

---

## Project Structure

```
github-resolver/
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── prisma.config.ts      # Prisma configuration
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...all]/
│   │   │           └── route.ts     # Better Auth catch-all handler
│   │   ├── login/
│   │   │   └── page.tsx             # GitHub OAuth login page
│   │   ├── dashboard/
│   │   │   ├── layout.tsx           # Protected layout with sidebar
│   │   │   └── page.tsx             # Dashboard home
│   │   ├── layout.tsx               # Root layout with QueryProvider
│   │   └── globals.css
│   ├── components/
│   │   └── sidebar.tsx              # Navigation sidebar
│   ├── lib/
│   │   ├── prisma.ts                # Prisma client singleton
│   │   ├── auth.ts                  # Better Auth server config
│   │   └── auth-client.ts           # Better Auth client config
│   ├── providers/
│   │   └── query-provider.tsx       # TanStack Query provider
│   └── middleware.ts                # Route protection
├── .env                             # Environment variables
└── package.json
```

---

## Environment Variables

```env
# Neon PostgreSQL — get from neon.tech dashboard
DATABASE_URL="postgresql://USER:PASSWORD@HOST/dbname?sslmode=require"

# Better Auth — generate with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-random-secret"
BETTER_AUTH_URL="http://localhost:3000"

# GitHub OAuth App — create at github.com/settings/developers
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Upstash Redis — get from upstash.com (needed in later phases)
REDIS_URL="rediss://your-upstash-url"
```

---

## Dependencies Installed

### Core
```bash
npm install prisma @prisma/client @prisma/adapter-pg pg
npm install better-auth
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install octokit
npm install bullmq ioredis
```

### UI
```bash
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react
```

### Dev
```bash
npm install -D prisma tsx @types/pg dotenv
```

---

## Phase 1 — Foundation & Auth Setup

### Step 1 — Scaffold Next.js Project

```bash
npx create-next-app@latest github-resolver \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

cd github-resolver
```

### Step 2 — Prisma Setup

Initialize Prisma:
```bash
npx prisma init
```

Create `prisma.config.ts` in the root:
```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

**Critical:** Do NOT add a custom `output` to the generator in `schema.prisma`. Use the default:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}
```

> ⚠️ **Lesson learned:** Adding `output = "../src/generated/prisma"` to the generator causes the Prisma client to be generated in a custom folder. If that folder is deleted or the import path mismatches, Better Auth cannot find the database models and throws a `Model verification does not exist` error. Always use the default output so `@prisma/client` resolves from `node_modules`.

### Step 3 — Better Auth Schema Generation

Run the Better Auth CLI to auto-generate the required auth models (`User`, `Session`, `Account`, `Verification`) into your schema:

```bash
npx @better-auth/cli generate
```

Say `y` when asked to overwrite the schema. This generates the exact field types and `@@map` directives Better Auth expects.

Then push to Neon and regenerate the client:
```bash
npx prisma db push
npx prisma generate
```

**Always run in this order:**
1. `prisma db push` — creates tables in Neon
2. `prisma generate` — generates TypeScript client

> ⚠️ **Lesson learned:** `prisma generate` only generates the TypeScript client on your machine. It does NOT create tables in the database. `prisma db push` is what actually creates the tables. Running only `generate` without `db push` leaves the database empty, causing Better Auth's `Model verification does not exist` error.

### Step 4 — Verify Database Connection

```bash
npx prisma db pull
```

This introspects your Neon database and confirms the connection works. You should see output like:
```
✔ Introspected 5 models and wrote them into prisma/schema.prisma
```

To visually inspect your tables:
```bash
npx prisma studio
```

Opens at `http://localhost:5555`.

### Step 5 — Prisma Client Singleton

`src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

> ⚠️ Always import from `@prisma/client` — never from a custom generated path.

### Step 6 — Better Auth Server Config

`src/lib/auth.ts`:
```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  trustedOrigins: ["http://localhost:3000"],
});
```

### Step 7 — Better Auth Client Config

`src/lib/auth-client.ts`:
```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
});

export const { signIn, signUp, useSession } = createAuthClient();
```

### Step 8 — Auth API Route

`src/app/api/auth/[...all]/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

### Step 9 — TanStack Query Provider

`src/providers/query-provider.tsx`:
```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

Wrap root layout:
```typescript
// src/app/layout.tsx
import { QueryProvider } from "@/providers/query-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

### Step 10 — Middleware (Route Protection)

`src/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const session = await getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login";
  const isProtected = pathname.startsWith("/dashboard");

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
```

### Step 11 — Login Page

`src/app/login/page.tsx`:
```typescript
"use client";

import { authClient } from "@/lib/auth-client";
import { Github } from "lucide-react";

export default function LoginPage() {
  const handleGithubLogin = async () => {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    });
  };

  return (
    <main className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="border border-[#1A1A2E] rounded-2xl p-10 flex flex-col items-center gap-6 max-w-sm w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            GitHub<span className="text-[#00FFA3]">Resolver</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Connect your GitHub to get started
          </p>
        </div>
        <button
          onClick={handleGithubLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-medium py-3 px-6 rounded-xl hover:bg-zinc-100 transition-colors"
        >
          <Github size={18} />
          Continue with GitHub
        </button>
      </div>
    </main>
  );
}
```

### Step 12 — GitHub OAuth App Setup

1. Go to `github.com/settings/developers`
2. Click **OAuth Apps → New OAuth App**
3. Set:
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copy **Client ID** and **Client Secret** into `.env`

### Step 13 — Current Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id            String    @id
  name          String
  email         String
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]

  @@unique([email])
  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([token])
  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?

  @@index([identifier])
  @@map("verification")
}

model Repo {
  id        String   @id @default(cuid())
  userId    String
  githubId  Int      @unique
  name      String
  fullName  String
  private   Boolean  @default(false)
  webhookId Int?
  createdAt DateTime @default(now())
}
```

---

## Verification Checklist

After Phase 1 setup, verify everything works:

- `http://localhost:3000/login` — login page loads
- Click "Continue with GitHub" — redirects to GitHub authorization
- After authorizing — lands on `/dashboard`
- `http://localhost:3000/api/auth/get-session` — returns your session JSON
- `npx prisma studio` — shows `user`, `session`, `account`, `verification` rows

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `Model verification does not exist` | Tables not created in DB | Run `npx prisma db push` then `npx prisma generate` |
| `Module '@prisma/client' has no exported member 'PrismaClient'` | Custom output path in schema, client not generated | Remove `output` from generator, run `npx prisma generate` |
| `404 on /login` | Login page not created yet | Create `src/app/login/page.tsx` |
| `500 on /api/auth/sign-in/social` | Auth models missing from DB | Run `npx @better-auth/cli generate` then `prisma db push` |

---

## Phase 1 Status — Complete ✅

- ✅ Next.js 14 with App Router + TypeScript + Tailwind
- ✅ Prisma ORM connected to Neon PostgreSQL
- ✅ Better Auth with GitHub OAuth
- ✅ Auth models in database (User, Session, Account, Verification)
- ✅ TanStack Query provider set up globally
- ✅ Protected dashboard route via middleware
- ✅ Login page with GitHub OAuth button
- ✅ Repo model added to schema (ready for Phase 2)

**Next: Phase 2 — GitHub Webhook Receiver + Event Ingestion Pipeline**
