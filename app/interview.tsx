"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";

export default function Interview() {
  return (
    <ConversationProvider>
      <InterviewInner />
    </ConversationProvider>
  );
}

function InterviewInner() {
  const conversation = useConversation({
    onConnect: () => console.log("connected"),
    onDisconnect: () => console.log("disconnected"),
    onMessage: (message) => console.log("message", message),
    onError: (error) => console.error("error", error),
  });

  const start = async () => {
    await navigator.mediaDevices.getUserMedia({ audio: true }); // mic permission
    await conversation.startSession({
      agentId: process.env.NEXT_PUBLIC_AGENT_ID!,
      connectionType: "webrtc",
    });
  };

  return (
    <main className="p-8 space-y-4">
      <p>Status: {conversation.status}</p>
      <p>Agent speaking: {conversation.isSpeaking ? "yes 🗣️" : "no 👂"}</p>
      <button onClick={start} className="border px-4 py-2">
        Start interview
      </button>
      <button
        onClick={() => conversation.endSession()}
        className="border px-4 py-2 ml-2"
      >
        End
      </button>
    </main>
  );
}
