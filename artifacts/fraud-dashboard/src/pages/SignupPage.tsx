import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegister, setAuthTokenGetter } from "@workspace/api-client-react";
import { Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import CaptchaWidget from "@/components/CaptchaWidget";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaPassed, setCaptchaPassed] = useState(false);

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data: any) => {
        localStorage.setItem("fraud_token", data.token);
        setAuthTokenGetter(() => data.token);
        toast.success(`Welcome, ${data.user.name}!`);
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast.error(err?.data?.message ?? "Failed to create account");
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
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    registerMutation.mutate({ data: { name, email, password } });
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
            <h2 className="text-base font-semibold text-foreground">Create account</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fill in the details below to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                placeholder="Jane Smith"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                  placeholder="Min. 6 characters"
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

            {/* CAPTCHA */}
            <CaptchaWidget onVerified={setCaptchaPassed} />

            <button
              type="submit"
              disabled={registerMutation.isPending || !captchaPassed}
              className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {registerMutation.isPending ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground pt-1">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
