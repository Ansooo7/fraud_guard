import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin, useResendVerification, setAuthTokenGetter } from "@workspace/api-client-react";
import { Shield, Eye, EyeOff, Mail } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("admin@fraudguard.io");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

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
          const unverified = err?.data?.email ?? email;
          setUnverifiedEmail(unverified);
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
        toast.success("Verification email resent — check your inbox.");
        setLocation(`/check-email?email=${encodeURIComponent(unverifiedEmail ?? "")}`);
      },
      onError: () => toast.error("Failed to resend. Please try again."),
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUnverifiedEmail(null);
    loginMutation.mutate({ data: { email, password } });
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
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-foreground mb-5">Sign in to continue</h2>

          {/* Email-not-verified banner */}
          {unverifiedEmail && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
              <Mail className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-400 mb-0.5">Email not verified</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Please verify <span className="font-medium">{unverifiedEmail}</span> before signing in.
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

          <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="mt-5 p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground font-medium mb-1">Demo credentials</p>
            <p className="text-xs text-muted-foreground">Admin: admin@fraudguard.io / admin123</p>
            <p className="text-xs text-muted-foreground">Analyst: analyst@fraudguard.io / analyst123</p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-5">
            New to FraudGuard?{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
