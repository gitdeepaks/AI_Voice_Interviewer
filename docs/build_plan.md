# 🎙️ Voice Interviewer: Production Plan (11 small days)

**Where it is today:** Next.js + `@elevenlabs/react` (`useConversation`, WebRTC), a **public** agent via `NEXT_PUBLIC_AGENT_ID`, and `data/questions.json` (16 questions, 4 categories).

**Where it ends:** a deployed app where a signed-in user picks a category, does a voice interview, and gets a scored feedback report. It's secure, cost-capped, tested and monitored. You can demo it in an ElevenLabs application.

**Time:** 60–90 min a day, in the build slot. One day = one branch = one PR.

---

## ✅ What "production ready" means here

| Area        | Done when                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Security    | The agent is private. The ElevenLabs key lives only on the server, and the client gets a short-lived token.         |
| Cost        | Sign-in is required. Users get a sessions-per-day limit and a max call length, and the token route is rate limited. |
| Data        | Sessions and transcripts are stored in Postgres (Prisma + Neon).                                                    |
| Value       | After the call, the user sees a feedback report scored against `goodAnswerCovers`.                                  |
| Reliability | The webhook is signature-checked and idempotent. Mic and network errors are handled.                                |
| Quality     | Tests and CI run typecheck, lint and test on every PR.                                                              |
| Operations  | Env vars are validated at boot, errors are tracked, and the app runs on Vercel production.                          |
| Story       | The README has an architecture diagram and trade-offs, and there's a 60-second demo video.                          |

---

## 🧭 Rules for every Claude Code session
1. Start in **plan mode**. Claude Code proposes a plan, you approve or change it, and only then does it write code.
2. Tell it: *"Check the current ElevenLabs docs before using any API; don't guess endpoint or SDK names."*
3. **You review the diff** with that day's "You review" list. If you can't explain a line, ask before merging.
4. **Run the app yourself** before merging. A passing build is not proof that it works.
5. API keys go only in `.env.local` / Vercel env. Never paste them into a chat or a commit.
6. **Next.js 16:** `middleware.ts` is now `proxy.ts`, and with `cacheComponents: true`, pages that call `auth()` or read cookies need `<Suspense>` or `connection()`.
7. **Never import `questions.json` into a client component.** The rubric (`goodAnswerCovers`) and `myStory` stay on the server.
8. **Skills** (installed once on Day 0, project level): `elevenlabs/skills` (Agents), `prisma/skills`, `clerk/skills` (setup + Next.js patterns), and `vercel-react-best-practices` from `vercel-labs/agent-skills`. Read each SKILL.md before installing, and only install from official owners.

---

## Day 0: Give Claude Code the context (20 min)
**First, install the skills (project level):**
```bash
npx skills add elevenlabs/skills        # pick only the Agents skill when asked
npx skills add prisma/skills
npx skills add clerk/skills --skill clerk-setup
npx skills add clerk/skills --skill clerk-nextjs-patterns
npx skills add vercel-labs/agent-skills # pick only vercel-react-best-practices
```

**Prompt:**
> Read this repo. Write a `CLAUDE.md` with: the stack, the commands (dev, build, test), the folder layout, and these rules: TypeScript strict, Bun, no secrets in client code, validate all external input with Zod. Then list the gaps between this repo and the production checklist in `docs/build_plan.md`. Don't change any code yet.

**You review:** Is the gap list right? Did it miss anything you know about?
**Done when:** `CLAUDE.md`, `docs/build_plan.md` and `docs/gaps.md` are committed, and the uncommitted interview work is committed on its own branch first.

---

## Day 1: Prompt from data, category picker
**Prompt:**
> First, switch the repo to Bun: run `bun install`, delete `package-lock.json`, and run scripts with `bun`. Then install Zod and put the question schema in one shared server-only module. `scripts/build-prompt.ts` validates `data/questions.json` with it and builds the interviewer system prompt with **only** each question and its `followUps`, never `goodAnswerCovers` or `myStory` (the agent doesn't need the rubric; only the Day 6 scorer does). Add a category picker on the home page. The client passes **only the category id** as a dynamic variable at `startSession` (check the ElevenLabs docs for how dynamic variables are declared in the prompt). The agent asks one question at a time from that category, uses `followUps`, and never gives the answer.

**You review:** What happens if `questions.json` has a typo? (Zod should fail loudly.) Is the prompt built in one place only? Search the client bundle for a phrase from `goodAnswerCovers`: it must not appear.
**Done when:** picking "System design" means the agent asks only system design questions.
**Interview line:** "Questions are data, not hardcoded prompt text, so adding a category is a JSON change."

---

## Day 2: Private agent + server-side token 🔐
**Prompt:**
> Make the agent private (enable authentication in the agent's settings; tell me which toggle). Add a Next.js route handler `POST /api/conversation-token` that calls the ElevenLabs API with `ELEVENLABS_API_KEY` (server only) and returns a short-lived conversation token for WebRTC. The client calls this route and starts the session with the token. Remove the `NEXT_PUBLIC_` agent dependency.

**You review:**
- Search the built client bundle (`.next/static`) for your key prefix: it must not appear.
- What does the token route return when ElevenLabs is down? (A clean 502, not a stack trace.)

**Done when:** the old public way of connecting fails, and the app still works through the token.
**Interview line:** "The browser never sees the API key. It gets a short-lived token from my server, which is also where I enforce limits."

---

## Day 3: Sign-in + cost guard 💸
**Prompt:**
> Add Clerk sign-in with the Clerk skills (Next 16: `clerkMiddleware()` goes in `proxy.ts`). Protect `/api/conversation-token` and read the user id with `auth()` on the server, never from the request body. Add a token-bucket rate limit per user on the token route with Upstash Redis (e.g. 5 requests/minute), returning 429 with a `Retry-After` header. Set the agent's max call duration to 10 minutes. The **daily quota (3 sessions/day) comes on Day 4 from the database**, not Redis.

**You review:** Is the limit checked **before** calling ElevenLabs? Fail open or fail closed if Redis is down? (Decide and write down why.)
**Done when:** signed-out requests get 401, and hammering the token route gets 429 with `Retry-After`.
**Why two mechanisms?** Redis rate limit = abuse protection (short, fast, can be lost). DB quota = business rule (durable, auditable). One job each, one source of truth each.
**Interview line:** "Voice minutes cost real money, so limits sit on the server, in front of the paid API." (This is your rate-limiting HLD in a real product.)

---

## Day 4: Database (Prisma + Neon)
**Prompt:**
> Add Prisma with Neon Postgres (use the Prisma skill). Use Neon's **pooled** connection string for the app (`DATABASE_URL`) and the **direct** one for migrations (`DIRECT_URL`), so serverless functions don't run out of connections. Models: `interview_sessions` (id, clerkUserId (indexed), category, elevenlabsConversationId unique, status: started | completed | failed, startedAt, endedAt, durationSec), `transcripts` (sessionId, turns jsonb), `feedback` (sessionId, overallScore, report jsonb). Create a session row (unguessable id) when a token is issued, and return its id to the client. Before issuing a token, count today's rows for this `clerkUserId`: 3 or more → 429 with a clear message (the daily quota). Add migrations.

**You review:** Why no `users` table? (Clerk owns users; we store `clerkUserId`. Add a table plus Clerk webhooks only when we need user data in our DB.) Which columns need indexes? (clerkUserId + startedAt for "sessions today".) Where is the unique constraint, and why?
**Done when:** every call creates a row you can see in Neon, and a 4th session on the same day is refused.

---

## Day 5: Post-call webhook, verified and idempotent
**Prompt:**
> Add `POST /api/webhooks/elevenlabs` for the post-call transcription webhook. Read the **raw body** with `await request.text()` and verify the HMAC signature with the webhook secret **before** `JSON.parse` (reject on mismatch or an old timestamp). Match the webhook to our session through a `session_id` dynamic variable the client passes at `startSession` (it comes back in the payload), so a closed tab doesn't lose the link; upsert on the conversation id. Make it idempotent: a unique constraint on the conversation id, claimed first, so a duplicate delivery is a no-op. Store the transcript, mark the session completed, and return 200 quickly. Don't do slow work inside the request.

**You review:** What happens if ElevenLabs sends the same webhook twice? If your DB is down? (Return non-2xx so it retries.)
**Done when:** a finished call shows its transcript in the DB, and replaying the same payload changes nothing.
**Interview line:** "Webhooks are at-least-once, so I verify the signature and make the handler idempotent with a unique key." (Your queue notes, live.)

---

## Day 6: Feedback report (the actual value) ⭐
**Prompt:**
> After the transcript is stored, generate feedback **outside the request path** (Vercel `after()` or a small queue). For each question asked, an LLM scores the answer 1–5 against `goodAnswerCovers` and returns structured output validated with Zod: `covered[]`, `missed[]`, `oneTip`. Retry with backoff; mark it failed after 3 tries. Build `/sessions/[id]` to show the report and the transcript.

**You review:** What if the LLM returns invalid JSON? Is the rubric (`goodAnswerCovers`) the single source of truth? Compare: ElevenLabs also has built-in evaluation criteria. Why build your own? (Richer per-question report, and you own the data.)
**Decide:** the current agent prompt gives spoken feedback and reveals answers at the end. Recommended: cut that and let the written report do the job (shorter calls, fewer paid voice minutes).
**Done when:** finishing a call leads to a feedback page within about 30 seconds.

---

## Day 7: UX hardening
**Prompt:**
> Handle every state: mic permission denied (show how to allow it), connecting, listening, agent speaking, disconnected/reconnect, ElevenLabs error, daily limit reached. Add an end-call button, a call timer and a mobile-friendly layout. Add a sessions history page.

**You review:** Deny the mic permission and see what happens. Turn off Wi-Fi mid-call and see what happens.
**Done when:** no state leaves the user staring at a blank screen.

---

## Day 8: Tests + CI
**Prompt:**
> Add tests with `bun test`: the Zod schema for `questions.json`, `build-prompt`, the webhook (valid signature, bad signature, duplicate delivery), and the token route (signed out → 401, over limit → 429). Add a GitHub Actions workflow: install, typecheck, lint, test on every PR.

**You review:** Do the tests fail if you break the code? (Break one thing on purpose and check.)
**Done when:** CI is green on the PR and red when a test is broken.

---

## Day 9: Observability + production deploy
**Prompt:**
> Validate all env vars with Zod at startup (fail fast with a clear message). Add Sentry (or structured logs) for API routes and the client. Log session id, user id, duration and status for each call. Deploy to Vercel production with all env vars set, point the ElevenLabs webhook at the production URL, and give me a checklist to verify it.

**You review:** Run one full call on production: token, call, webhook, feedback page. Can you find that call in the logs?
**Done when:** the full flow works on the production URL.

---

## Day 10: Ship the story 🚀
**Prompt:**
> Write the README: what it does, a Mermaid architecture diagram (browser → token route → ElevenLabs → webhook → DB → feedback worker), setup steps, and a "Decisions and trade-offs" section (ElevenLabs vs LiveKit/Pipecat, a token vs a public agent, our own scoring vs built-in evaluation, limits and cost).

**You do:**
- Record a 60-second demo.
- Post the launch post and reel.
- Add the app to your resume's Projects section.
- Link it in your ElevenLabs applications.

**Done when:** a stranger can understand, run and try it from the README.

---

## 🎤 The 30-second project story (practise saying this)
> "I built a voice mock-interviewer on ElevenLabs Agents. The browser never sees the API key: my server issues short-lived tokens after checking auth and a per-user rate limit, because voice minutes cost money. When a call ends, ElevenLabs sends a webhook, which I verify and handle idempotently. A background job then scores each answer against a rubric with structured LLM output, and the user gets a report. It's Next.js, Clerk, Prisma on Neon, Upstash for rate limiting, and it's tested in CI."