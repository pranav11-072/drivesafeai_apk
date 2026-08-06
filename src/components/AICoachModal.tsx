import React, { useState } from 'react';
import { X, Bot, Send, Sparkles, User, RefreshCw, Lightbulb } from 'lucide-react';

interface AICoachModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export const AICoachModal: React.FC<AICoachModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Hello! I am your DriveSafe Gemini AI Safety Coach. How can I help you improve road safety, prevent micro-sleeps, or plan optimal rest stops today?'
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isSending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputPrompt,
    };

    setMessages(prev => [...prev, userMsg]);
    const currentQuery = inputPrompt;
    setInputPrompt('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai/safety-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentQuery }),
      });

      const data = await res.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.advice || "To maintain optimal alertness, take a 15-minute rest break every 2 hours, keep cool cabin air circulating, and pull over if your eyelids feel heavy."
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.warn("Safety coach response error:", err);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: "Ensure you take breaks every 2 hours, drink water, and keep cabin temperature cool."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const quickPrompts = [
    "How to prevent micro-sleeps on long highway drives?",
    "What are signs of driver fatigue before yawning?",
    "Quick 5-minute rest stop exercises for drivers"
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Gemini Driver AI Safety Coach</h3>
              <p className="text-[11px] text-slate-400">Personalized fatigue prevention & driving advice</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[82%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex gap-2.5 items-center text-xs text-indigo-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Gemini AI is analyzing driving recommendations...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2 px-4 bg-slate-950 border-t border-slate-800/80 flex gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
          {quickPrompts.map((promptText, i) => (
            <button
              key={i}
              onClick={() => {
                setInputPrompt(promptText);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-2.5 py-1 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1"
            >
              <Lightbulb className="w-3 h-3 text-amber-400" />
              <span>{promptText}</span>
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask about fatigue management, rest stops..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isSending}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white p-2 sm:px-4 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        </form>
      </div>
    </div>
  );
};
