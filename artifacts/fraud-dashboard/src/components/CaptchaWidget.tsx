import { useState, useEffect, useRef } from "react";
import { RefreshCw, CheckCircle2, Shield } from "lucide-react";

type CaptchaState = "idle" | "challenge" | "verified" | "failed";

interface Challenge {
  display: string;
  answer: number;
  type: "math" | "sequence";
}

function generateChallenge(): Challenge {
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * 3)]!;

  let a: number, b: number, answer: number;

  if (op === "+") {
    a = Math.floor(Math.random() * 12) + 2;
    b = Math.floor(Math.random() * 12) + 2;
    answer = a + b;
    return { display: `${a}  +  ${b}`, answer, type: "math" };
  } else if (op === "-") {
    b = Math.floor(Math.random() * 9) + 1;
    a = b + Math.floor(Math.random() * 10) + 1;
    answer = a - b;
    return { display: `${a}  −  ${b}`, answer, type: "math" };
  } else {
    a = Math.floor(Math.random() * 9) + 2;
    b = Math.floor(Math.random() * 5) + 2;
    answer = a * b;
    return { display: `${a}  ×  ${b}`, answer, type: "math" };
  }
}

// Noise/distortion chars drawn on the SVG canvas around the text
function ChallengeCanvas({ text }: { text: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background noise lines
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.bezierCurveTo(
        Math.random() * W, Math.random() * H,
        Math.random() * W, Math.random() * H,
        Math.random() * W, Math.random() * H,
      );
      ctx.strokeStyle = `rgba(99,130,255,${0.12 + Math.random() * 0.12})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Noise dots
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150,150,255,${0.2 + Math.random() * 0.2})`;
      ctx.fill();
    }

    // Draw text with slight per-character tilt
    const chars = text.split("");
    const totalW = chars.length * 20;
    let x = (W - totalW) / 2 + 8;

    chars.forEach((ch) => {
      ctx.save();
      const tilt = (Math.random() - 0.5) * 0.35;
      const yJitter = (Math.random() - 0.5) * 6;
      ctx.translate(x + 9, H / 2 + yJitter);
      ctx.rotate(tilt);
      ctx.font = `bold ${22 + Math.floor(Math.random() * 5)}px monospace`;
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      x += 20;
    });
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={60}
      className="rounded-md border border-border/50 bg-muted/30"
    />
  );
}

interface CaptchaWidgetProps {
  onVerified: (verified: boolean) => void;
}

export default function CaptchaWidget({ onVerified }: CaptchaWidgetProps) {
  const [state, setState] = useState<CaptchaState>("idle");
  const [challenge, setChallenge] = useState<Challenge>(() => generateChallenge());
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setChallenge(generateChallenge());
    setInput("");
    setState("challenge");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleCheck() {
    if (state === "verified") return;
    setState("challenge");
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(input.trim(), 10);
    if (val === challenge.answer) {
      setState("verified");
      onVerified(true);
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setChallenge(generateChallenge());
        setInput("");
      }, 600);
    }
  }

  function handleReset() {
    setState("idle");
    onVerified(false);
    setInput("");
    setChallenge(generateChallenge());
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* reCAPTCHA-style header row */}
      <div
        onClick={handleCheck}
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors select-none ${
          state === "verified" ? "cursor-default" : ""
        }`}
      >
        {/* Checkbox */}
        <div
          className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
            state === "verified"
              ? "bg-green-500 border-green-500"
              : "border-muted-foreground/40 bg-background"
          }`}
        >
          {state === "verified" && (
            <svg viewBox="0 0 12 10" className="w-3 h-3 fill-none stroke-white stroke-2">
              <polyline points="1,5 4.5,9 11,1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <span className="text-sm text-foreground font-medium flex-1">
          {state === "verified" ? "Verified — you're human" : "I'm not a robot"}
        </span>

        {/* reCAPTCHA badge */}
        <div className="flex flex-col items-center opacity-50">
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-[8px] text-muted-foreground font-medium tracking-wide">FraudGuard</span>
        </div>
      </div>

      {/* Challenge panel */}
      {state === "challenge" && (
        <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Solve the equation to verify you're human
          </p>

          {/* Distorted canvas challenge */}
          <div className="flex justify-center">
            <ChallengeCanvas text={challenge.display + " = ?"} />
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Your answer"
              className={`flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm text-center font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition ${
                shake ? "animate-[shake_0.5s_ease-in-out]" : ""
              }`}
              style={
                shake
                  ? { animation: "shake 0.5s ease-in-out" }
                  : {}
              }
              autoComplete="off"
              required
            />
            <button
              type="button"
              onClick={refresh}
              title="New challenge"
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
            >
              Verify
            </button>
          </form>

          {shake && (
            <p className="text-xs text-red-400 text-center">Wrong answer — try again</p>
          )}
        </div>
      )}

      {state === "verified" && (
        <div className="border-t border-green-500/20 bg-green-500/5 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-green-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Human verification passed
          </span>
          <button onClick={handleReset} className="text-[10px] text-muted-foreground hover:text-foreground transition">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
