// app/interview/[jobId]/[resumeId]/page.tsx
"use client";
import React, { useState, useEffect, useRef } from "react";
import { useProctoring } from "@/hooks/useProctoring";
import { VideoPanel } from "@/components/ui/interview/videopanel";

interface Message {
  sender: "ai" | "you";
  text: string;
  timestamp?: Date;
}

interface InterviewStatus {
  question_count: number;
  max_questions: number;
  is_complete: boolean;
}

export default function InterviewPage({ params }: { params: Promise<{ jobId: string; resumeId: string }> }) {
  const [jobId, setJobId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InterviewStatus>({ question_count: 0, max_questions: 8, is_complete: false });
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    camStream,
    screenStream,
    camRef,
    screenRef,
    startCam,
    startScreen,
    calibration,
  } = useProctoring(ws);

  // Speak util with sentence grouping
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    setIsSpeaking(true);
    const segments = text.split(/([.?!]\s+)/).filter(Boolean);
    let idx = 0;
    const speakNext = () => {
      if (idx >= segments.length) {
        setIsSpeaking(false);
        return;
      }
      const ut = new SpeechSynthesisUtterance(segments[idx++]);
      ut.onend = speakNext;
      window.speechSynthesis.speak(ut);
    };
    speakNext();
  };

  // Resolve params
  useEffect(() => {
    (async () => {
      const p = await params;
      setJobId(p.jobId);
      setResumeId(p.resumeId);
    })();
  }, [params]);

  // Init WebSocket
  useEffect(() => {
    if (!jobId || !resumeId || !screenStream) return;
    const socket = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/ws/interview/${jobId}/${resumeId}`);
    socket.onopen = () => { setIsConnected(true); setError(null); };
    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.error) { setError(data.error); setIsLoading(false); return; }
        const { text, question_count, max_questions } = data;
        setStatus({
          question_count,
          max_questions: max_questions || status.max_questions,
          is_complete: question_count >= (max_questions || status.max_questions),
        });
        setMessages((ms) => [...ms, { sender: "ai", text, timestamp: new Date() }]);
        setIsLoading(false);
      } catch {
        setError("Invalid response from server");
        setIsLoading(false);
      }
    };
    socket.onclose = (ev) => {
      setIsConnected(false);
      if (ev.code !== 1000) setError("Connection lost. Please refresh.");
    };
    socket.onerror = () => setError("Connection error. Please try again.");
    setWs(socket);
    return () => socket.close();
  }, [jobId, resumeId, screenStream]);

  // Auto‐scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send answer
  const sendAnswer = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !input.trim() || isLoading) return;
    setIsLoading(true); setError(null);
    ws.send(JSON.stringify({ answer: input }));
    setMessages((ms) => [...ms, { sender: "you", text: input, timestamp: new Date() }]);
    setInput("");
  };

  // End early
  const endInterview = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ answer: "end interview" }));
    }
  };

  // If not calibrated yet, show calibration UI
  if (!calibration.done && camStream) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <p className="mb-4 text-gray-700">
          Click the circle {calibration.points - calibration.count} more time(s) to calibrate your gaze.
        </p>
        <button
          onClick={calibration.record}
          className="w-12 h-12 bg-blue-600 rounded-full hover:bg-blue-700 transition"
        />
      </div>
    );
  }

  // If no screen share yet
  if (!screenStream) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <VideoPanel
          camStream={camStream}
          screenStream={screenStream}
          startCam={startCam}
          startScreen={startScreen}
          camRef={camRef}
          screenRef={screenRef}
        />
        <p className="mt-4 text-gray-700">Please share your screen to begin the interview.</p>
      </div>
    );
  }

  // — Main UI —
  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI Interview Session</h1>
          <div className="text-sm text-gray-600">
            Question {status.question_count} of {status.max_questions}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <button
            onClick={endInterview}
            disabled={!isConnected}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            End Interview
          </button>
        </div>
      </div>

      {/* Video Panels */}
      <div className="p-4">
        <VideoPanel
          camStream={camStream}
          screenStream={screenStream}
          startCam={startCam}
          startScreen={startScreen}
          camRef={camRef}
          screenRef={screenRef}
        />
      </div>

      {/* Progress Bar */}
      <div className="px-4 mb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(status.question_count / status.max_questions) * 100}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === "you" ? "justify-end" : ""}`}>
            <div className={`
              px-4 py-3 rounded-lg max-w-[75%]
              ${m.sender === "you"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-black border"}
            `}>
              <div className="whitespace-pre-wrap">{m.text}</div>
              {m.sender === "ai" && (
                <button
                  onClick={() => speak(m.text)}
                  disabled={isSpeaking}
                  className="mt-2 text-sm underline"
                >
                  {isSpeaking ? "Speaking..." : "🔊 Play"}
                </button>
              )}
              {m.timestamp && (
                <div className={`text-xs mt-1 ${m.sender === "you" ? "text-blue-100" : "text-gray-500"}`}>
                  {m.timestamp.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start px-4">
            <div className="bg-gray-100 px-4 py-3 rounded-lg border flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
              <span className="text-gray-600">AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!status.is_complete && (
        <div className="border-t px-4 py-4">
          <div className="flex items-end gap-3">
            <textarea
              className="flex-1 border rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendAnswer();
                }
              }}
              placeholder="Type your answer here..."
              rows={3}
              disabled={!isConnected || isLoading}
            />
            <button
              onClick={sendAnswer}
              disabled={!input.trim() || !isConnected || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      )}

      {/* Completion */}
      {status.is_complete && (
        <div className="m-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg text-center">
          <h3 className="font-semibold mb-2">Interview Complete!</h3>
          <p>Thank you for participating in this interview. You’ll hear back soon.</p>
        </div>
      )}
    </div>
  );
}
