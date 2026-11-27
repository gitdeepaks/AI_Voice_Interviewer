// The app's question loader. It is the only app module that reads
// data/questions.json, and "server-only" makes the build fail if a client
// component imports it, so the rubric never reaches the browser.

import "server-only";

import * as z from "zod";
import questionsJson from "@/data/questions.json";
import { QuestionBankSchema, categoryOptions, type CategoryOption } from "./questions";

// Validated once, at module load: a typo in the JSON fails dev and `next build`.
const parsed = QuestionBankSchema.safeParse(questionsJson);
if (!parsed.success) {
  throw new Error(`data/questions.json is invalid:\n${z.prettifyError(parsed.error)}`);
}
const questions = parsed.data;

// Ids and labels only. This is all the client needs to render the picker.
export function getCategoryOptions(): CategoryOption[] {
  return categoryOptions(questions);
}
