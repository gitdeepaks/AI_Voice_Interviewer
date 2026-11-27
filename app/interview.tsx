"use client";

import { useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
// Type-only import, erased at build time. Never import data/questions.json or
// lib/questions.server here: only category ids and labels reach the client.
import type { CategoryOption } from "@/lib/questions";

type InterviewProps = { categories: CategoryOption[] };

export default function Interview({ categories }: InterviewProps) {
  return (
    <ConversationProvider>
      <InterviewInner categories={categories} />
    </ConversationProvider>
  );
}

// Public agent for now. Day 2 replaces this with a server-issued token.
const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID;

function InterviewInner({ categories }: InterviewProps) {
  const [selected, setSelected] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => setError(null),
    onError: (message) => setError(message),
  });

  const idle = conversation.status === "disconnected" || conversation.status === "error";

  const start = async () => {
    setError(null);
    if (!AGENT_ID) {
      setError("Agent not configured: set NEXT_PUBLIC_AGENT_ID in .env.local.");
      return;
    }
    // Send only an id from the server-provided list, never free text: the
    // value is inserted into the agent's system prompt.
    const category = categories.find((c) => c.id === selected);
    if (!category) {
      setError("Pick a category first.");
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access is needed for the interview. Allow it in your browser and try again.");
      return;
    }
    conversation.startSession({
      agentId: AGENT_ID,
      connectionType: "webrtc",
      dynamicVariables: { category: category.id },
    });
  };

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Voice mock interview</h1>

      <fieldset disabled={!idle} className="space-y-2 disabled:opacity-60">
        <legend className="mb-2 font-medium">Pick a category</legend>
        {categories.map((c) => (
          <label key={c.id} className="flex items-center gap-2">
            <input
              type="radio"
              name="category"
              value={c.id}
              checked={selected === c.id}
              onChange={() => setSelected(c.id)}
            />
            {c.label}
          </label>
        ))}
      </fieldset>

      <div className="space-y-1">
        <p>Status: {conversation.status}</p>
        <p>Agent speaking: {conversation.isSpeaking ? "yes 🗣️" : "no 👂"}</p>
      </div>

      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={start} disabled={!idle} className="border px-4 py-2 disabled:opacity-50">
          Start interview
        </button>
        <button
          onClick={() => conversation.endSession()}
          disabled={idle}
          className="border px-4 py-2 disabled:opacity-50"
        >
          End
        </button>
      </div>
    </main>
  );
}
