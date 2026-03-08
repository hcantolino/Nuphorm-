import React, { useState, useRef, useEffect, useCallback } from "react";

/* ── Web Speech API types (not in all TS libs) ──────────────────────── */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

/* ── Clinical post-processing corrections ───────────────────────────── */
const CORRECTIONS: [RegExp, string][] = [
  [/\bp value\b/gi, "p-value"],
  [/\bt half\b/gi, "t½"],
  [/\bkaplan meyer\b/gi, "Kaplan-Meier"],
  [/\barea under the curve\b/gi, "AUC"],
  [/\bconfidence interval\b/gi, "95% CI"],
  [/\bstandard deviation\b/gi, "SD"],
];

function applyCorrections(text: string): string {
  let out = text;
  for (const [rx, replacement] of CORRECTIONS) out = out.replace(rx, replacement);
  return out;
}

/* ── Waveform bar animation keyframes (injected once) ───────────────── */
const STYLE_ID = "voice-dictation-keyframes";
function ensureKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
@keyframes vd-wave {
  0%   { height: 4px; }
  100% { height: 14px; }
}`;
  document.head.appendChild(style);
}

/* ── Detect browser support ─────────────────────────────────────────── */
function getSpeechCtor(): SpeechRecognitionCtor | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/* ── Props ──────────────────────────────────────────────────────────── */
interface VoiceDictationButtonProps {
  /** Current text in the chat input */
  inputValue: string;
  /** Set the chat input value */
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  /** Ref to the textarea element for background styling */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Called to submit the current query */
  onSubmit: () => void;
}

/* ── Component ──────────────────────────────────────────────────────── */
export function VoiceDictationButton({
  inputValue,
  setInputValue,
  textareaRef,
  onSubmit,
}: VoiceDictationButtonProps) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const retryCountRef = useRef(0);
  const intentionalStopRef = useRef(false);
  const prefixRef = useRef(""); // text before dictation started
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Check support on mount ────────────────────────────────────── */
  useEffect(() => {
    if (!getSpeechCtor()) setSupported(false);
    ensureKeyframes();
  }, []);

  /* ── Cleanup on unmount ────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  /* ── Start recognition ─────────────────────────────────────────── */
  const startRecognition = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) { setSupported(false); return; }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    recognitionRef.current = rec;
    intentionalStopRef.current = false;
    retryCountRef.current = 0;
    prefixRef.current = inputValue;

    // Apply background tint to textarea
    if (textareaRef.current) {
      textareaRef.current.style.backgroundColor = "#eff6ff";
    }

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      const combined = (finalText + (interimText ? interimText : "")).trim();
      const prefix = prefixRef.current;
      const separator = prefix && !prefix.endsWith(" ") ? " " : "";
      setInputValue(prefix + separator + combined);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setSupported(false);
        setRecording(false);
        return;
      }
      // For other errors: let onend handle restart logic
    };

    rec.onend = () => {
      if (intentionalStopRef.current) return;
      // Unexpected stop — auto-retry once
      if (retryCountRef.current < 1) {
        retryCountRef.current++;
        try { rec.start(); } catch { stopRecording(); }
      } else {
        stopRecording();
      }
    };

    try {
      rec.start();
      setRecording(true);
    } catch {
      setSupported(false);
    }
  }, [inputValue, setInputValue, textareaRef]);

  /* ── Stop recognition ──────────────────────────────────────────── */
  const stopRecording = useCallback(() => {
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);

    // Restore textarea background
    if (textareaRef.current) {
      textareaRef.current.style.backgroundColor = "";
    }

    // Apply corrections to current input
    setInputValue(prev => applyCorrections(prev));

    // Show confirmation tag
    setShowConfirmation(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setShowConfirmation(false), 2000);
  }, [setInputValue, textareaRef]);

  /* ── Toggle ────────────────────────────────────────────────────── */
  const toggle = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecognition();
    }
  }, [recording, stopRecording, startRecognition]);

  /* ── Enter while recording → stop + submit ─────────────────────── */
  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        stopRecording();
        // Allow state to settle, then submit
        requestAnimationFrame(() => onSubmit());
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording, stopRecording, onSubmit]);

  /* ── Hide completely if unsupported ────────────────────────────── */
  if (!supported) return null;

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title="Dictate"
        aria-label={recording ? "Stop voice dictation" : "Start voice dictation"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          padding: 0,
          cursor: "pointer",
          transition: "all 0.15s ease",
          border: recording ? "none" : "1px solid #e5e7eb",
          backgroundColor: recording ? "#2563eb" : "#ffffff",
          boxShadow: recording
            ? "0 0 0 3px rgba(37,99,235,0.2)"
            : "none",
        }}
        onMouseEnter={(e) => {
          if (!recording) {
            const btn = e.currentTarget;
            btn.style.backgroundColor = "#f3f4f6";
            const svg = btn.querySelector("svg");
            if (svg) svg.style.stroke = "#2563eb";
          }
        }}
        onMouseLeave={(e) => {
          if (!recording) {
            const btn = e.currentTarget;
            btn.style.backgroundColor = "#ffffff";
            const svg = btn.querySelector("svg");
            if (svg) svg.style.stroke = "#6b7280";
          }
        }}
      >
        {recording ? (
          /* Waveform bars when recording */
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              height: "14px",
            }}
          >
            {[0, 0.15, 0.3].map((delay, i) => (
              <span
                key={i}
                style={{
                  width: "3px",
                  borderRadius: "2px",
                  backgroundColor: "#ffffff",
                  animation: `vd-wave 0.6s ease-in-out ${delay}s infinite alternate`,
                }}
              />
            ))}
          </span>
        ) : (
          /* Microphone SVG when idle */
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: "stroke 0.15s ease" }}
          >
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M19 10a7 7 0 0 1-14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        )}
      </button>

      {/* Confirmation tag */}
      {showConfirmation && (
        <span
          style={{
            position: "absolute",
            bottom: "-22px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "11px",
            color: "#16a34a",
            whiteSpace: "nowrap",
            opacity: 1,
            transition: "opacity 0.3s ease",
            pointerEvents: "none",
          }}
        >
          ✓ Dictation complete
        </span>
      )}
    </>
  );
}
