import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import SystemTesting from "@/pages/SystemTesting";
import Analytics from "@/pages/Analytics";
import QATools from "@/pages/QATools";
import Companies from "@/pages/Companies";
import Login from "@/pages/Login";
import SimpleLogin from "@/pages/SimpleLogin";
import Users from "@/pages/Users";
import LotUpload from "@/pages/LotUpload";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AuditLog from "@/pages/AuditLog";
import CherryPickers from "@/pages/CherryPickers";
import Customers from "@/pages/Customers";
import PickupRecords from "@/pages/PickupRecords";
import BillingReports from "@/pages/BillingReports";
import WebhookMonitoring from "@/pages/WebhookMonitoring";
import FranchiseDashboard from "@/pages/FranchiseDashboard";
import PEBuildings from "@/pages/PropertyEnumeration/Buildings";
import PESessions from "@/pages/PropertyEnumeration/Sessions";
import PEAnalytics from "@/pages/PropertyEnumeration/Analytics";
import PESyncMonitor from "@/pages/PropertyEnumeration/SyncMonitor";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={SimpleLogin} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/testing">
        <ProtectedRoute>
          <SystemTesting />
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute>
          <Analytics />
        </ProtectedRoute>
      </Route>
      <Route path="/qa-tools">
        <ProtectedRoute>
          <QATools />
        </ProtectedRoute>
      </Route>
      <Route path="/companies">
        <ProtectedRoute>
          <Companies />
        </ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute>
          <Users />
        </ProtectedRoute>
      </Route>
      <Route path="/lot-upload">
        <ProtectedRoute>
          <LotUpload />
        </ProtectedRoute>
      </Route>
      <Route path="/cherry-pickers">
        <ProtectedRoute>
          <CherryPickers />
        </ProtectedRoute>
      </Route>
      <Route path="/audit-log">
        <ProtectedRoute>
          <AuditLog />
        </ProtectedRoute>
      </Route>
      <Route path="/customers">
        <ProtectedRoute>
          <Customers />
        </ProtectedRoute>
      </Route>
      <Route path="/pickup-records">
        <ProtectedRoute>
          <PickupRecords />
        </ProtectedRoute>
      </Route>
      <Route path="/billing-reports">
        <ProtectedRoute>
          <BillingReports />
        </ProtectedRoute>
      </Route>
      <Route path="/webhook-monitoring">
        <ProtectedRoute>
          <WebhookMonitoring />
        </ProtectedRoute>
      </Route>
      <Route path="/franchise">
        <ProtectedRoute>
          <FranchiseDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/property-enumeration/buildings">
        <ProtectedRoute>
          <PEBuildings />
        </ProtectedRoute>
      </Route>
      <Route path="/property-enumeration/sessions">
        <ProtectedRoute>
          <PESessions />
        </ProtectedRoute>
      </Route>
      <Route path="/property-enumeration/analytics">
        <ProtectedRoute>
          <PEAnalytics />
        </ProtectedRoute>
      </Route>
      <Route path="/property-enumeration/sync-monitor">
        <ProtectedRoute>
          <PESyncMonitor />
        </ProtectedRoute>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
