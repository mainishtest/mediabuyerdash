"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface FloatingAssistantProps {
  hasAlerts?: boolean;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const STARTER_QUESTIONS = [
  "What needs attention today?",
  "Which campaigns are underperforming?",
  "Show me creative fatigue alerts",
];

export function FloatingAssistant({
  hasAlerts = false,
  clientId,
  dateFrom,
  dateTo,
}: FloatingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Handle click outside to close panel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Check if click is on the FAB
        const fab = document.getElementById("floating-assistant-fab");
        if (fab && !fab.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
      return () => document.removeEventListener("keydown", handleEscapeKey);
    }
  }, [isOpen]);

  const makeId = () => Math.random().toString(36).slice(2, 10);

  const handleSendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || loading) return;

      // Add user message
      const userMessage: Message = {
        id: makeId(),
        role: "user",
        content: messageText,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setLoading(true);

      // Add loading placeholder
      const loadingId = makeId();
      setMessages((prev) => [
        ...prev,
        {
          id: loadingId,
          role: "assistant",
          content: "__loading__",
        },
      ]);

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: messageText,
            clientId,
            dateFrom,
            dateTo,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Replace loading message with actual response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingId
              ? { ...msg, content: data.summary || "No response" }
              : msg
          )
        );
      } catch (error) {
        // Replace loading message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingId
              ? {
                  ...msg,
                  content:
                    "Sorry, I couldn't generate a response. Please check your connection and try again.",
                }
              : msg
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [loading, clientId, dateFrom, dateTo]
  );

  const handleStarterQuestion = (question: string) => {
    handleSendMessage(question);
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="floating-assistant-fab"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg transition-all duration-200 hover:bg-emerald-500 flex items-center justify-center ${
          hasAlerts ? "animate-pulse" : ""
        }`}
        aria-label="Open AI Assistant"
      >
        {/* Inline sparkle/brain SVG icon */}
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Brain-like sparkle icon */}
          <path d="M12 2v4M12 18v4M6 12H2M22 12h-4M5.64 5.64l2.83 2.83M15.53 15.53l2.83 2.83M5.64 18.36l2.83-2.83M15.53 8.47l2.83-2.83" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Slide-up Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-24px)] h-[500px] max-h-[calc(100vh-140px)]
                     flex flex-col bg-slate-900 border border-slate-700 rounded-lg shadow-2xl
                     animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-100">AI Assistant</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              aria-label="Close assistant"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Message Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-6">
                <div className="text-emerald-600 text-2xl">✨</div>
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-3">
                    Start with a question
                  </p>
                  <div className="space-y-2">
                    {STARTER_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        onClick={() => handleStarterQuestion(question)}
                        disabled={loading}
                        className="block w-full text-left px-3 py-2 text-xs bg-slate-800
                                 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-slate-300 rounded-lg transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg text-xs ${
                        msg.role === "user"
                          ? "bg-emerald-600 text-white"
                          : msg.content === "__loading__"
                            ? "bg-slate-800 text-slate-400"
                            : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      {msg.content === "__loading__" ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="animate-bounce inline-block">.</span>
                          <span className="animate-bounce inline-block" style={{ animationDelay: "0.1s" }}>
                            .
                          </span>
                          <span className="animate-bounce inline-block" style={{ animationDelay: "0.2s" }}>
                            .
                          </span>
                        </span>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-700 p-3 bg-slate-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex gap-2 items-end"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question…"
                disabled={loading}
                className="flex-1 px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg
                           text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600
                           disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed
                           text-white text-xs font-medium rounded-lg transition-colors shrink-0"
              >
                {loading ? "…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
