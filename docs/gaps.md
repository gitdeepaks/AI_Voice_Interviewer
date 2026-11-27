# Gaps: repo vs production checklist

Snapshot taken on Day 0 (2026-11-15), on branch `add-question-bank`. It compares the repo with the "What production ready means here" table in `docs/build_plan.md`. Typecheck and lint pass today, and `bun run -s build-prompt` works.

## By checklist area

| Area | Today | Gap | Fixed on |
| --- | --- | --- | --- |
| Security | The agent is public. `app/interview.tsx` starts the session with `process.env.NEXT_PUBLIC_AGENT_ID!`, so the agent id is in the client bundle and anyone can open calls on your account. | Make the agent private. Add `POST /api/conversation-token` (server-only `ELEVENLABS_API_KEY`). Remove `NEXT_PUBLIC_AGENT_ID`. There are no API routes yet. | Day 2 |
| Cost | No sign-in, no limits, no max call length. | Clerk, 3 sessions per user per day, Upstash token bucket returning 429 + `Retry-After`, and a 10-minute max duration on the agent. | Day 3 |
| Data | Nothing is stored. | Prisma + Neon (pooled `DATABASE_URL`, direct `DIRECT_URL`), the `interview_sessions` / `transcripts` / `feedback` models, and migrations. | Day 4 |
| Value | The only feedback is the agent's spoken summary at the end (step 6 of the prompt). Nothing is written down or scored. | A post-call scored report per question against `goodAnswerCovers`, and a `/sessions/[id]` page. | Day 6 |
| Reliability | `start()` doesn't catch errors: if the mic is denied or `startSession` fails, you get an unhandled rejection and the UI shows nothing. `onError` only logs to the console. No webhook. | An HMAC-verified, idempotent post-call webhook, and UI states for mic denied, connecting, errors, disconnect and limit reached. | Days 5, 7 |
| Quality | No tests, no `test` or `typecheck` script, no CI. Zod isn't installed: `scripts/build-prompt.ts` validates by hand. | Install Zod and use a shared schema. Add `bun test` suites and a GitHub Actions workflow (install, typecheck, lint, test). | Days 1, 8 |
| Operations | No env validation (env vars are read with `!`). No error tracking. Never deployed. No `.env.example`. | Zod env schema at boot, Sentry or structured logs, Vercel production deploy, `.env.example` listing var names only. | Day 9 |
| Story | `README.md` is create-next-app boilerplate. `app/layout.tsx` metadata still says "Create Next App". | README with Mermaid diagram, setup steps and trade-offs. Real page title. Demo video. | Day 10 |

## Not tied to one day

1. **npm vs Bun.** The repo has `package-lock.json` and no `bun.lock`, and `build-prompt` runs under `node`. The plan fixes this at the start of Day 1.
2. **Interview UI (done on Day 0).** `app/interview.tsx`, the new `app/page.tsx` and the `@elevenlabs/react` dependency are committed on their own branch, `interview-ui`.
3. **Skills (done on Day 0).** These are installed at project level in `.agents/skills`, with symlinks in `.claude/skills`, and listed in `skills-lock.json`: `agents` (ElevenLabs), `clerk-setup`, `clerk-nextjs-patterns`, `vercel-react-best-practices`, `prisma-orm-setup`, `prisma-client-api`, `prisma-cli`. Inside Claude Code, the `skills` CLI skips the picker and installs every skill in the repo, so always pass `--skill <name>`.

## Plan risks: now covered in `build_plan.md`

These were raised on Day 0, and the revised plan handles them:

- The Day 0 prompt now points at `docs/build_plan.md`.
- Day 1: the agent prompt has only questions and `followUps`, and the client sends only the category id (rules 7 and 8).
- Day 3: `clerkMiddleware()` goes in `proxy.ts` (rule 6).
- Day 3 vs Day 4: Redis handles the rate limit and the DB handles the daily quota, each as the single source of truth for its job.
- Day 5: a `session_id` dynamic variable links the webhook to the session, and HMAC is checked on the raw body before `JSON.parse`.
- Day 6: decide whether to drop the spoken feedback.
- `cacheComponents` needs `<Suspense>` or `connection()` (rule 6).
- Day 1: the schema and prompt builder stay free of `server-only`, which throws outside Next and would break the script and `bun test`. Only the app's question loader imports it.
- Days 1–2: the category is client input. The token route validates it with a Zod enum (400 otherwise), and the agent prompt falls back to the first category when the value is missing or unknown.
- Day 4: the daily quota counts and inserts in one transaction under `pg_advisory_xact_lock` on the user id. "Today" means the last 24 hours (rolling), and `failed` sessions don't count.
- Day 5: the webhook links with a conditional update, only to a session that is `started` and has no conversation id (or the same one). Zero rows updated → ignore, log and return 200, so a forged or replayed `session_id` can't overwrite a finished session.
- Day 0: every install command uses `--skill`, so running from an agent doesn't install whole repos.

## Plan risks still open

None right now.
