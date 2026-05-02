import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import CheckEmailPage from "@/pages/CheckEmailPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import DashboardPage from "@/pages/DashboardPage";
import TransactionsPage from "@/pages/TransactionsPage";
import AlertsPage from "@/pages/AlertsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import UsersPage from "@/pages/UsersPage";
import FraudCheckPage from "@/pages/FraudCheckPage";
import BatchFraudCheckPage from "@/pages/BatchFraudCheckPage";
import RulesPage from "@/pages/RulesPage";
import CasesPage from "@/pages/CasesPage";
import BlacklistPage from "@/pages/BlacklistPage";
import AppLayout from "@/components/AppLayout";

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function useAuthToken() {
  const token = localStorage.getItem("fraud_token");
  return token;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const token = useAuthToken();
  if (!token) return <Redirect to="/login" />;
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function AppRoutes() {
  const token = useAuthToken();
  const [location] = useLocation();

  useEffect(() => {
    const t = localStorage.getItem("fraud_token");
    if (t) {
      setAuthTokenGetter(() => t);
    }
  }, [location]);

  return (
    <Switch>
      <Route path="/login">
        {token ? <Redirect to="/dashboard" /> : <LoginPage />}
      </Route>
      <Route path="/signup">
        {token ? <Redirect to="/dashboard" /> : <SignupPage />}
      </Route>
      <Route path="/check-email">
        <CheckEmailPage />
      </Route>
      <Route path="/verify-email">
        <VerifyEmailPage />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/transactions">
        <ProtectedRoute component={TransactionsPage} />
      </Route>
      <Route path="/alerts">
        <ProtectedRoute component={AlertsPage} />
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={AnalyticsPage} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={UsersPage} />
      </Route>
      <Route path="/fraud-check">
        <ProtectedRoute component={FraudCheckPage} />
      </Route>
      <Route path="/fraud-batch">
        <ProtectedRoute component={BatchFraudCheckPage} />
      </Route>
      <Route path="/rules">
        <ProtectedRoute component={RulesPage} />
      </Route>
      <Route path="/cases">
        <ProtectedRoute component={CasesPage} />
      </Route>
      <Route path="/blocklist">
        <ProtectedRoute component={BlacklistPage} />
      </Route>
      <Route path="/">
        {token ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster position="top-right" theme="dark" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
