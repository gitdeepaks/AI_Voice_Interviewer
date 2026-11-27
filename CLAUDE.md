@AGENTS.md

# Voice Interviewer

A voice mock-interviewer. The user does a spoken interview with an ElevenLabs Conversational AI agent over WebRTC. The roadmap is `docs/build_plan.md` (one day = one branch = one PR) and the open gaps are in `docs/gaps.md`.

## Stack

- **Next.js 16.4** (App Router, Turbopack, `cacheComponents: true`, `partialPrefetching: true`). React 19.3, TypeScript 5 (strict).
- **Tailwind CSS 4** through `@tailwindcss/turbopack` (configured in `next.config.ts`).
- **ElevenLabs Agents** via `@elevenlabs/react` (`ConversationProvider` + `useConversation`, `connectionType: "webrtc"`).
- **Bun** is the package manager and test runner (Bun 1.4, Node 24 is also installed). The repo still has an npm `package-lock.json`; see `docs/gaps.md`.
- Planned (not installed yet): Zod, Clerk, Prisma + Neon Postgres, Upstash Redis, Sentry, Vercel.

## Commands

```bash
bun install                      # install deps
bun run dev                      # dev server on http://localhost:3000
bun run build                    # production build
bun run start                    # serve the production build
bun run lint                     # ESLint (next core-web-vitals + typescript)
bunx tsc --noEmit                # typecheck (no script yet)
bun test                         # tests (none yet; added on Day 8)
bun run -s build-prompt          # print the interviewer system prompt from data/questions.json
```

## Layout

```
app/
  layout.tsx          root layout, Geist fonts
  page.tsx            home page (server component), renders <Interview />
  interview.tsx       client component: mic permission + ElevenLabs session
  globals.css         Tailwind entry
data/
  questions.json      question bank: 16 questions, 4 categories
                      (system-design, javascript, ai-engineering, behavioral)
scripts/
  build-prompt.ts     validates questions.json and prints the agent system prompt
  package.json        {"type":"module"} so Node runs the script as ESM
docs/
  build_plan.md       the 11-day production plan
  gaps.md             gaps between the repo and the production checklist
```

Each question has `id`, `category`, `difficulty`, `question`, `followUps[]`, `goodAnswerCovers[]`. Behavioral questions also have `myStory`, which is the owner's private notes.

## Rules

1. **TypeScript strict.** No `any`, no `@ts-ignore`, no non-null `!` on values that can really be missing (env vars especially). Fix the types.
2. **Bun.** Use `bun` / `bunx` for installing, running scripts and tests. Don't add npm, yarn or pnpm lockfiles.
3. **No secrets in client code.** Nothing secret goes in a `"use client"` file, a `NEXT_PUBLIC_*` var, or anything a client component imports. `ELEVENLABS_API_KEY`, the webhook secret, DB URLs and Redis tokens are read only in route handlers or server modules (add `import "server-only"` to those modules). Secrets live only in `.env.local` / Vercel env and are never committed or pasted into chat.
4. **The rubric is private.** `goodAnswerCovers` and `myStory` must never reach the browser bundle or network responses. Don't import `data/questions.json` from a client component. Send the client only what it renders (for example category ids and labels).
5. **Validate all external input with Zod**: request bodies, query params, webhook payloads, env vars, LLM output and `data/questions.json`. Parse, don't cast. Return clean 4xx/5xx JSON errors, never stack traces.
6. **Server decides identity and limits.** Read the user id with Clerk's `auth()` on the server, never from the request body. Check auth and rate limits *before* calling a paid API (ElevenLabs, the LLM).
7. **Check the docs before using an API.** Look up the current ElevenLabs, Clerk, Prisma and Upstash docs (or the installed skills) and the Next.js guides in `node_modules/next/dist/docs/` before writing integration code. Don't guess endpoint, SDK or config names.
8. **One prompt builder.** The interviewer prompt is built in one place, from `data/questions.json`. Don't copy question text into other files.

## Next.js 16 notes

- `middleware.ts` is deprecated and renamed to **`proxy.ts`** (same functionality, export named `proxy`). Clerk's `clerkMiddleware()` goes in `proxy.ts`. See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- `cacheComponents` is on, so pages that read request data (`auth()`, `cookies()`, `headers()`) need a `<Suspense>` boundary or `await connection()`. Read `node_modules/next/dist/docs/01-app/01-getting-started/` before you add a dynamic page.
- `after()` (from `next/server`) runs work after the response is sent. Use it for the post-webhook feedback job.
- Route handlers live in `app/**/route.ts`. Read webhook bodies with `await request.text()` so the HMAC is checked against the raw bytes.

## Skills

Project skills live in `.agents/skills` (with symlinks in `.claude/skills`), and their sources are listed in `skills-lock.json`. Use them before writing integration code: `agents` (ElevenLabs Agents), `clerk-setup` and `clerk-nextjs-patterns`, `prisma-orm-setup`, `prisma-client-api` and `prisma-cli`, and `vercel-react-best-practices`. To add one, run `npx skills add <owner/repo> --skill <name>`. Without `--skill`, it installs every skill in the repo.

## Workflow

- Start each task in plan mode and get approval before writing code.
- Before handing work back, run lint and typecheck, and also `bun test` once tests exist.
- Don't commit or push unless asked. Don't commit `.env*`.
