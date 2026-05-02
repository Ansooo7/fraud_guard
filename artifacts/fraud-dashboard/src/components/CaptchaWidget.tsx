import { useState, useEffect, useRef } from "react";
import { RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";

type CaptchaState = "idle" | "checking" | "challenge" | "verified";

interface Challenge {
  display: string;
  answer: number;
}

function generateChallenge(): Challenge {
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * 3)]!;
  let a: number, b: number, answer: number;
  if (op === "+") {
    a = Math.floor(Math.random() * 15) + 3;
    b = Math.floor(Math.random() * 15) + 3;
    answer = a + b;
    return { display: `${a} + ${b}`, answer };
  } else if (op === "-") {
    b = Math.floor(Math.random() * 9) + 1;
    a = b + Math.floor(Math.random() * 12) + 2;
    answer = a - b;
    return { display: `${a} − ${b}`, answer };
  } else {
    a = Math.floor(Math.random() * 8) + 2;
    b = Math.floor(Math.random() * 6) + 2;
    answer = a * b;
    return { display: `${a} × ${b}`, answer };
  }
}

function ChallengeCanvas({ challenge }: { challenge: Challenge }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "rgba(30,41,59,0.9)");
    grad.addColorStop(1, "rgba(15,23,42,0.9)");
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, W, H, 8);
    ctx.fill();

    // Wavy interference lines
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const y0 = Math.random() * H;
      ctx.moveTo(0, y0);
      for (let x = 0; x <= W; x += 8) {
        ctx.lineTo(x, y0 + Math.sin(x / 18 + i) * 6);
      }
      ctx.strokeStyle = `rgba(99,102,241,${0.08 + Math.random() * 0.1})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Random dots
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(148,163,184,${0.15 + Math.random() * 0.2})`;
      ctx.fill();
    }

    // Draw each character with per-char tilt + jitter
    const text = `${challenge.display} = ?`;
    const chars = text.split("");
    const charW = Math.min(24, (W - 24) / chars.length);
    let x = (W - chars.length * charW) / 2 + charW / 2;

    chars.forEach((ch) => {
      ctx.save();
      const tilt = (Math.random() - 0.5) * 0.4;
      const yJitter = (Math.random() - 0.5) * 8;
      ctx.translate(x, H / 2 + yJitter);
      ctx.rotate(tilt);
      const size = 20 + Math.floor(Math.random() * 6);
      ctx.font = `bold ${size}px monospace`;
      // Slight shadow
      ctx.shadowColor = "rgba(99,102,241,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = ch === " " ? "transparent" : `hsl(${210 + Math.random() * 40}, 80%, ${80 + Math.random() * 15}%)`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      x += charW;
    });
  }, [challenge]);

  return (
    <canvas
      ref={ref}
      width={260}
      height={68}
      className="rounded-lg w-full"
      style={{ maxWidth: 260 }}
    />
  );
}

interface CaptchaWidgetProps {
  onVerified: (v: boolean) => void;
}

export default function CaptchaWidget({ onVerified }: CaptchaWidgetProps) {
  const [state, setState] = useState<CaptchaState>("idle");
  const [challenge, setChallenge] = useState<Challenge>(generateChallenge);
  const [input, setInput] = useState("");
  const [wrongShake, setWrongShake] = useState(false);
  const [wrongMsg, setWrongMsg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function triggerChallenge() {
    if (state === "verified") return;
    setState("checking");
    // Simulate a brief "checking" pause like real reCAPTCHA
    setTimeout(() => {
      setState("challenge");
      setTimeout(() => inputRef.current?.focus(), 50);
    }, 600);
  }

  function refresh() {
    setChallenge(generateChallenge());
    setInput("");
    setWrongMsg(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(input.trim(), 10);
    if (val === challenge.answer) {
      setState("verified");
      onVerified(true);
    } else {
      setWrongShake(true);
      setWrongMsg(true);
      setTimeout(() => {
        setWrongShake(false);
        setChallenge(generateChallenge());
        setInput("");
        setTimeout(() => setWrongMsg(false), 1200);
      }, 550);
    }
  }

  function handleReset() {
    setState("idle");
    setInput("");
    setWrongMsg(false);
    setChallenge(generateChallenge());
    onVerified(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden select-none">
      {/* ── Top row ── */}
      <div
        onClick={triggerChallenge}
        className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
          state === "verified" || state === "checking"
            ? "cursor-default"
            : "cursor-pointer hover:bg-muted/20"
        }`}
      >
        {/* Animated checkbox / spinner / check */}
        <div className="relative w-6 h-6 flex-shrink-0">
          {state === "idle" && (
            <div className="w-6 h-6 rounded border-2 border-muted-foreground/40 bg-background" />
          )}

          {state === "checking" && (
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}

          {state === "challenge" && (
            <div className="w-6 h-6 rounded border-2 border-primary/60 bg-primary/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-primary/60" />
            </div>
          )}

          {state === "verified" && (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          )}
        </div>

        <span className={`text-sm font-medium flex-1 ${state === "verified" ? "text-green-400" : "text-foreground"}`}>
          {state === "verified" ? "Verified — you're human" : "I'm not a robot"}
        </span>

        <div className="flex flex-col items-center gap-0.5 opacity-40">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="text-[7px] tracking-widest text-muted-foreground font-semibold uppercase">FraudGuard</span>
        </div>
      </div>

      {/* ── Challenge panel ── */}
      {state === "challenge" && (
        <div className="border-t border-border bg-muted/10 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Solve to verify you're human</p>
            <button
              type="button"
              onClick={refresh}
              title="New challenge"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
            >
              <RefreshCw className="w-3 h-3" /> New
            </button>
          </div>

          <ChallengeCanvas challenge={challenge} />

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Answer"
              autoComplete="off"
              required
              className={`flex-1 bg-background border rounded-lg px-3 py-2 text-sm text-center font-mono font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition ${
                wrongShake ? "border-red-500/60" : "border-input"
              }`}
              style={wrongShake ? { animation: "shake 0.5s ease-in-out" } : {}}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-30"
            >
              OK
            </button>
          </form>

          {wrongMsg && (
            <p className="text-xs text-red-400 text-center">Incorrect — try the new challenge</p>
          )}
        </div>
      )}

      {/* ── Verified footer ── */}
      {state === "verified" && (
        <div className="border-t border-green-500/20 bg-green-500/5 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-green-400">Verification complete</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] text-muted-foreground hover:text-foreground transition"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
