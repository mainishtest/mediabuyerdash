"use client";

import { ResponseCard } from "./ResponseCard";
import type { OptimizationAssistantMessage } from "../../../lib/optimizationAssistant/types";

interface ConversationThreadProps {
  messages: OptimizationAssistantMessage[];
  onFollowUp: (text: string) => void;
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[75%] px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl rounded-tr-sm">
        <p className="text-slate-100 text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  onFollowUp,
}: {
  message: OptimizationAssistantMessage;
  onFollowUp: (text: string) => void;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-full sm:max-w-[90%] w-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-emerald-800 border border-emerald-600 flex items-center justify-center text-xs text-emerald-300">
            ◈
          </div>
          <span className="text-xs text-slate-500">AI Assistant</span>
        </div>
        <div className="px-4 py-4 bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm space-y-4">
          {message.response ? (
            <ResponseCard responseId={message.id} response={message.response} onFollowUp={onFollowUp} />
          ) : (
            <p className="text-slate-400 text-sm">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="px-4 py-4 bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0ms]" />
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function ConversationThread({ messages, onFollowUp }: ConversationThreadProps) {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-6">
      {messages.map((msg) =>
        msg.role === "user" ? (
          <UserBubble key={msg.id} content={msg.content} />
        ) : msg.content === "__loading__" ? (
          <LoadingBubble key={msg.id} />
        ) : (
          <AssistantBubble key={msg.id} message={msg} onFollowUp={onFollowUp} />
        )
      )}
    </div>
  );
}
