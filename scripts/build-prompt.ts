// Prints the interviewer system prompt for the ElevenLabs agent, with the
// question bank from data/questions.json appended and grouped by category.
//
//   npm run -s build-prompt            # print to the terminal
//   npm run -s build-prompt | pbcopy   # copy to the clipboard (macOS)
//
// -s stops npm from printing its own "> voice-interviewer@..." header lines.

import { readFileSync } from "node:fs";

type Question = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  followUps: string[];
  goodAnswerCovers: string[];
};

const QUESTIONS_FILE = new URL("../data/questions.json", import.meta.url);

// Sections are asked in this order. Categories not listed here come last,
// in the order they first appear in the JSON.
const CATEGORY_LABELS: Record<string, string> = {
  "system-design": "System design",
  javascript: "JavaScript",
  "ai-engineering": "AI engineering",
  behavioral: "Behavioral",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

const basePrompt = (sectionSummary: string) => `# Personality

You are Alex, a senior engineering interviewer running a mock interview for a Senior Full Stack AI Engineer role. You are friendly, calm and direct. You want the candidate to do well, but you hold a high bar and you probe for depth.

# Environment

This is a live voice conversation. The candidate is practicing and can only hear you. They cannot see code, diagrams or any text you produce.

# Tone

- Speak in short, natural sentences, the way a person talks in an interview.
- Ask one question at a time, then stop and listen.
- Never use markdown, bullet points, code or symbols in what you say. Say "O of n" rather than "O(n)".
- Keep your own turns brief. The candidate should do most of the talking.
- Use brief acknowledgements like "Got it" or "Okay" without praising or judging the answer during the interview.

# Goal

1. Greet the candidate. Tell them the interview has ${sectionSummary} and takes about 45 minutes. Ask if they are ready.
2. Ask two questions from each section, moving through the sections in the order listed below. Pick questions from the bank; read each one close to how it is written.
3. After each answer, ask one or two of that question's follow-ups. Prefer follow-ups that target points from "A good answer covers" that the candidate missed or only touched on.
4. If the candidate is stuck, give one small hint, then move on if they are still stuck. Do not give the answer.
5. If the candidate asks you to repeat or clarify a question, do so briefly.
6. When all sections are done, give spoken feedback: for each question, one strength and one thing to improve, based on its "A good answer covers" points. Finish with an overall impression and the single most important thing to practice.

# Guardrails

- Never read out or reveal the "A good answer covers" points during the interview. They are for your judgment only.
- Do not answer the questions yourself, even if asked, until the feedback at the end.
- Stay on the interview. If the candidate goes off topic, steer back politely.
- If the candidate asks to stop early, give feedback on what you covered so far.`;

function loadQuestions(): Question[] {
  const raw: unknown = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error("data/questions.json must contain an array of questions");
  }

  // Copy only the fields the prompt uses, so extra fields such as myStory
  // never end up in the output.
  return raw.map((item, index): Question => {
    const where = `question ${index + 1}${item?.id ? ` (${item.id})` : ""}`;
    for (const key of ["id", "category", "difficulty", "question"] as const) {
      if (typeof item?.[key] !== "string" || item[key].trim() === "") {
        throw new Error(`${where}: "${key}" must be a non-empty string`);
      }
    }
    for (const key of ["followUps", "goodAnswerCovers"] as const) {
      if (!Array.isArray(item[key]) || !item[key].every((s: unknown) => typeof s === "string")) {
        throw new Error(`${where}: "${key}" must be an array of strings`);
      }
    }
    return {
      id: item.id,
      category: item.category,
      difficulty: item.difficulty,
      question: item.question,
      followUps: item.followUps,
      goodAnswerCovers: item.goodAnswerCovers,
    };
  });
}

function categoryLabel(category: string): string {
  return (
    CATEGORY_LABELS[category] ??
    category.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

function formatQuestion(q: Question, number: number): string {
  return [
    `### ${number}. ${q.id} (${q.difficulty})`,
    "",
    `Question: ${q.question}`,
    "",
    "Follow-ups:",
    ...q.followUps.map((f) => `- ${f}`),
    "",
    "A good answer covers (for your judgment only, never read aloud):",
    ...q.goodAnswerCovers.map((g) => `- ${g}`),
  ].join("\n");
}

function buildPrompt(questions: Question[]): string {
  const byCategory = new Map<string, Question[]>();
  for (const q of questions) {
    const group = byCategory.get(q.category) ?? [];
    group.push(q);
    byCategory.set(q.category, group);
  }

  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  // Array sort is stable, so unlisted categories keep their JSON order.
  const categories = [...byCategory.keys()].sort((a, b) => rank(a) - rank(b));

  const sections = categories.map((category) =>
    [
      `## ${categoryLabel(category)}`,
      "",
      byCategory
        .get(category)!
        .map((q, i) => formatQuestion(q, i + 1))
        .join("\n\n"),
    ].join("\n"),
  );

  // e.g. "4 sections (System design, JavaScript, AI engineering and Behavioral)"
  const labels = categories.map(categoryLabel);
  const sectionList =
    labels.length > 1
      ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`
      : labels[0];
  const sectionSummary = `${labels.length} section${labels.length === 1 ? "" : "s"} (${sectionList})`;

  return [basePrompt(sectionSummary), "# Question bank", ...sections].join("\n\n") + "\n";
}

process.stdout.write(buildPrompt(loadQuestions()));
