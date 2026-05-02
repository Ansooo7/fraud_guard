import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { verifyEmail, setAuthTokenGetter } from "@workspace/api-client-react";
import { Shield, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type State = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setErrorMsg("No verification token found in the URL.");
      setState("error");
      return;
    }

    verifyEmail({ token })
      .then((data) => {
        localStorage.setItem("fraud_token", data.token);
        setAuthTokenGetter(() => data.token);
        setState("success");
        setTimeout(() => setLocation("/dashboard"), 2000);
      })
      .catch((err: any) => {
        setErrorMsg(err?.data?.message ?? "This verification link is invalid or has expired.");
        setState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {state === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Verifying your email…</h2>
              <p className="text-sm text-muted-foreground">Just a moment, please wait.</p>
            </>
          )}

          {state === "success" && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-9 h-9 text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Email verified!</h2>
              <p className="text-sm text-muted-foreground">
                Your account is now active. Redirecting to your dashboard…
              </p>
            </>
          )}

          {state === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
                <XCircle className="w-9 h-9 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Verification failed</h2>
              <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
              <button
                onClick={() => setLocation("/login")}
                className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition mb-3"
              >
                Back to sign in
              </button>
              <button
                onClick={() => setLocation("/check-email")}
                className="w-full text-sm text-primary hover:underline transition"
              >
                Resend verification email
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
