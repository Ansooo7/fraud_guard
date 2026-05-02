import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin, setAuthTokenGetter } from "@workspace/api-client-react";
import { Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import CaptchaWidget from "@/components/CaptchaWidget";

export default function LoginPage() {
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaPassed, setCaptchaPassed] = useState(false);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("fraud_token", data.token);
        setAuthTokenGetter(() => data.token);
        setLocation("/dashboard");
      },
      onError: () => {
        toast.error("Invalid email or password");
        setCaptchaPassed(false);
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaPassed) {
      toast.error("Please complete the human verification first.");
      return;
    }
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
        <div className="bg-card border border-border rounded-xl shadow-lg p-6 space-y-4">
          <div className="mb-2">
            <h2 className="text-base font-semibold text-foreground">Sign in</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enter your credentials to access the dashboard</p>
          </div>

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
                placeholder="you@example.com"
                required
                autoFocus
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

            <CaptchaWidget onVerified={setCaptchaPassed} />

            <button
              data-testid="button-submit"
              type="submit"
              disabled={loginMutation.isPending || !captchaPassed}
              className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground pt-1">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Create account
            </Link>
          </p>
        </div>

        {/* Demo hint */}
        <div className="mt-4 p-3 bg-muted/40 rounded-lg border border-border text-center">
          <p className="text-xs text-muted-foreground font-medium mb-1">Demo credentials</p>
          <p className="text-xs text-muted-foreground">admin@fraudguard.io · admin123</p>
          <p className="text-xs text-muted-foreground">analyst@fraudguard.io · analyst123</p>
        </div>
      </div>
    </div>
  );
}
