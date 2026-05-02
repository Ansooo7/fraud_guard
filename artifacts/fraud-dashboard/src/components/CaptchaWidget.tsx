import { useState } from "react";
import { ShieldCheck } from "lucide-react";

interface CaptchaWidgetProps {
  onVerified: (v: boolean) => void;
}

export default function CaptchaWidget({ onVerified }: CaptchaWidgetProps) {
  const [checked, setChecked] = useState(false);
  const [animating, setAnimating] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (checked) return;
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      setChecked(true);
      onVerified(true);
    }, 500);
  }

  return (
    <div className="rounded-xl border border-border bg-card select-none">
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Checkbox */}
        <button
          type="button"
          onClick={handleClick}
          disabled={checked}
          aria-label="I'm not a robot"
          className="w-6 h-6 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all duration-200 focus:outline-none disabled:cursor-default"
          style={{
            borderColor: checked ? "#22c55e" : animating ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)",
            backgroundColor: checked ? "#22c55e" : animating ? "hsl(var(--primary) / 0.1)" : "hsl(var(--background))",
          }}
        >
          {animating && (
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          )}
          {checked && (
            <svg viewBox="0 0 12 10" className="w-3.5 h-3.5 fill-none stroke-white stroke-[2.5px]">
              <polyline points="1,5 4.5,9 11,1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <span className={`text-sm font-medium flex-1 transition-colors ${checked ? "text-green-400" : "text-foreground"}`}>
          {checked ? "Verified — you're human" : "I'm not a robot"}
        </span>

        <div className="flex flex-col items-center gap-0.5 opacity-40">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="text-[7px] tracking-widest text-muted-foreground font-semibold uppercase">FraudGuard</span>
        </div>
      </div>

      {checked && (
        <div className="border-t border-green-500/20 bg-green-500/5 px-4 py-1.5">
          <span className="text-xs text-green-400">Verification complete</span>
        </div>
      )}
    </div>
  );
}
