// Validates data/questions.json and prints the interviewer system prompt for
// the ElevenLabs agent. The prompt has each question and its follow-ups only,
// never goodAnswerCovers or myStory.
//
//   bun run build-prompt            # print to the terminal
//   bun run build-prompt | pbcopy   # copy to the clipboard (macOS)
//
// bun run prints its "$ bun scripts/build-prompt.ts" line to stderr, so the
// piped output is just the prompt.

import { readFileSync } from "node:fs";
import * as z from "zod";
import { QuestionBankSchema, buildInterviewerPrompt } from "../lib/questions";

const QUESTIONS_FILE = new URL("../data/questions.json", import.meta.url);

function fail(message: string): never {
  process.stderr.write(`data/questions.json is invalid:\n${message}\n`);
  process.exit(1);
}

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8"));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const parsed = QuestionBankSchema.safeParse(raw);
if (!parsed.success) fail(z.prettifyError(parsed.error));

process.stdout.write(buildInterviewerPrompt(parsed.data));
