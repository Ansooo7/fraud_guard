import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin, useResendVerification, useRequestOtp, useVerifyOtp, setAuthTokenGetter } from "@workspace/api-client-react";
import { Shield, Eye, EyeOff, Mail, KeyRound, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Tab = "password" | "magic";
type MagicStep = "email" | "code";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("magic");

  // Password login state
  const [email, setEmail] = useState("admin@fraudguard.io");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  // Magic code state
  const [magicEmail, setMagicEmail] = useState("");
  const [magicStep, setMagicStep] = useState<MagicStep>("email");
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  // ── Password login ────────────────────────────────────────────────────────
  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("fraud_token", data.token);
        setAuthTokenGetter(() => data.token);
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        const errorCode = err?.data?.error;
        if (errorCode === "email_not_verified") {
          setUnverifiedEmail(err?.data?.email ?? email);
          toast.error("Please verify your email before signing in.");
        } else {
          setUnverifiedEmail(null);
          toast.error("Invalid email or password");
        }
      },
    },
  });

  const resendMutation = useResendVerification({
    mutation: {
      onSuccess: () => {
        toast.success("Verification email resent.");
        setLocation(`/check-email?email=${encodeURIComponent(unverifiedEmail ?? "")}`);
      },
    },
  });

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUnverifiedEmail(null);
    loginMutation.mutate({ data: { email, password } });
  }

  // ── Magic code ─────────────────────────────────────────────────────────────
  const requestOtpMutation = useRequestOtp({
    mutation: {
      onSuccess: (data) => {
        const d = data as { message: string; devCode?: string };
        setMagicStep("code");
        if (d.devCode) {
          setDevCode(d.devCode);
        }
        toast.success("Verification code ready!");
      },
      onError: () => toast.error("Failed to send code. Try again."),
    },
  });

  const verifyOtpMutation = useVerifyOtp({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("fraud_token", data.token);
        setAuthTokenGetter(() => data.token);
        toast.success(`Welcome, ${data.user.name}!`);
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast.error(err?.data?.message ?? "Invalid or expired code.");
        setDevCode(null);
      },
    },
  });

  function handleMagicEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDevCode(null);
    setOtp("");
    requestOtpMutation.mutate({ data: { email: magicEmail } });
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    verifyOtpMutation.mutate({ data: { email: magicEmail, code: otp } });
  }

  function handleResendCode() {
    setOtp("");
    setDevCode(null);
    requestOtpMutation.mutate({ data: { email: magicEmail } });
  }

  // Auto-fill OTP from devCode
  function handleUseCode() {
    if (devCode) setOtp(devCode);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">FraudGuard</h1>
          <p className="text-sm text-muted-foreground mt-1">Banking Fraud Detection System</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("magic")}
              className={`flex-1 py-3 text-sm font-medium transition ${
                tab === "magic"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Magic Code
              </span>
            </button>
            <button
              onClick={() => setTab("password")}
              className={`flex-1 py-3 text-sm font-medium transition ${
                tab === "password"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Password
            </button>
          </div>

          <div className="p-6">
            {/* ── MAGIC CODE TAB ─────────────────────────────────────────── */}
            {tab === "magic" && (
              <>
                {magicStep === "email" && (
                  <form onSubmit={handleMagicEmailSubmit} className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Enter any email address to receive a one-time verification code. No password needed.
                      </p>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Email address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="email"
                          value={magicEmail}
                          onChange={(e) => setMagicEmail(e.target.value)}
                          className="w-full bg-background border border-input rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={requestOtpMutation.isPending}
                      className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {requestOtpMutation.isPending ? (
                        "Sending code…"
                      ) : (
                        <>Send verification code <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </form>
                )}

                {magicStep === "code" && (
                  <form onSubmit={handleOtpSubmit} className="space-y-4">
                    {/* Dev code banner */}
                    {devCode && (
                      <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">Demo mode — your code is:</p>
                        <div
                          className="text-3xl font-mono font-bold tracking-[0.35em] text-primary cursor-pointer hover:opacity-80 transition select-all"
                          onClick={handleUseCode}
                          title="Click to auto-fill"
                        >
                          {devCode}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Click the code to auto-fill ↓</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Enter the 6-digit code sent to{" "}
                        <span className="text-foreground font-medium">{magicEmail}</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="w-full bg-background border border-input rounded-lg px-3 py-3 text-center text-2xl font-mono font-bold tracking-[0.35em] text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                        placeholder="──────"
                        required
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={verifyOtpMutation.isPending || otp.length < 6}
                      className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyOtpMutation.isPending ? "Verifying…" : "Verify & Sign in"}
                    </button>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => { setMagicStep("email"); setDevCode(null); setOtp(""); }}
                        className="text-muted-foreground hover:text-foreground transition"
                      >
                        ← Change email
                      </button>
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={requestOtpMutation.isPending}
                        className="flex items-center gap-1 text-primary hover:text-primary/80 transition disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3 h-3 ${requestOtpMutation.isPending ? "animate-spin" : ""}`} />
                        Resend code
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* ── PASSWORD TAB ───────────────────────────────────────────── */}
            {tab === "password" && (
              <>
                {unverifiedEmail && (
                  <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                    <Mail className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-amber-400 mb-0.5">Email not verified</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Verify <span className="font-medium">{unverifiedEmail}</span> first.
                      </p>
                      <button
                        onClick={() => resendMutation.mutate({ data: { email: unverifiedEmail } })}
                        disabled={resendMutation.isPending}
                        className="text-xs text-primary hover:text-primary/80 transition font-medium disabled:opacity-50"
                      >
                        {resendMutation.isPending ? "Sending…" : "Resend verification email →"}
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Email address
                    </label>
                    <input
                      data-testid="input-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                      placeholder="admin@fraudguard.io"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        data-testid="input-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-background border border-input rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    data-testid="button-submit"
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loginMutation.isPending ? "Signing in…" : "Sign in"}
                  </button>
                </form>

                <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Demo credentials</p>
                  <p className="text-xs text-muted-foreground">Admin: admin@fraudguard.io / admin123</p>
                  <p className="text-xs text-muted-foreground">Analyst: analyst@fraudguard.io / analyst123</p>
                </div>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground mt-5">
              New to FraudGuard?{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
