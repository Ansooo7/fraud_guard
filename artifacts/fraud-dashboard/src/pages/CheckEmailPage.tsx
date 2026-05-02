import { useState } from "react";
import { Link } from "wouter";
import { useResendVerification } from "@workspace/api-client-react";
import { Shield, Mail, RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CheckEmailPageProps {
  email?: string;
}

export default function CheckEmailPage({ email }: CheckEmailPageProps) {
  // email may come from location state via query param
  const params = new URLSearchParams(window.location.search);
  const userEmail = email ?? params.get("email") ?? "";
  const [resent, setResent] = useState(false);

  const resendMutation = useResendVerification({
    mutation: {
      onSuccess: () => {
        setResent(true);
        toast.success("Verification email resent — check your inbox.");
      },
      onError: () => {
        toast.error("Failed to resend. Please try again.");
      },
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">FraudGuard</h1>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 shadow-lg text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-8 h-8 text-primary" />
          </div>

          <h2 className="text-lg font-semibold text-foreground mb-2">Check your email</h2>
          <p className="text-sm text-muted-foreground mb-1">
            We sent a verification link to
          </p>
          {userEmail && (
            <p className="text-sm font-medium text-foreground mb-4">{userEmail}</p>
          )}
          <p className="text-xs text-muted-foreground mb-6">
            Click the link in the email to verify your account. The link expires in 24 hours.
          </p>

          {/* Resend */}
          {resent ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-400 mb-4">
              <CheckCircle2 className="w-4 h-4" />
              <span>New link sent!</span>
            </div>
          ) : (
            <button
              onClick={() => resendMutation.mutate({ data: { email: userEmail } })}
              disabled={resendMutation.isPending || !userEmail}
              className="flex items-center gap-2 mx-auto text-sm text-primary hover:text-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`} />
              {resendMutation.isPending ? "Sending…" : "Resend verification email"}
            </button>
          )}

          {/* Dev tip */}
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-left">
            <p className="text-xs text-amber-400 font-medium mb-0.5">Development mode</p>
            <p className="text-xs text-muted-foreground">
              Email is not configured yet. Copy the verify URL from the API server console logs.
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-5">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
