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
import LotsManagement from "@/pages/LotsManagement";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AuditLog from "@/pages/AuditLog";
import CherryPickers from "@/pages/CherryPickers";
import Customers from "@/pages/Customers";
import PickupRecords from "@/pages/PickupRecords";
import BillingReports from "@/pages/BillingReports";
import BillingReconciliation from "@/pages/BillingReconciliation";
import BatchReinvoice from "@/pages/BatchReinvoice";
import WebhookMonitoring from "@/pages/WebhookMonitoring";
import FranchiseDashboard from "@/pages/FranchiseDashboard";
import CustomerApp from "@/pages/CustomerApp";
import PEBuildings from "@/pages/PropertyEnumeration/Buildings";
import PESessions from "@/pages/PropertyEnumeration/Sessions";
import PEAnalytics from "@/pages/PropertyEnumeration/Analytics";
import PESyncMonitor from "@/pages/PropertyEnumeration/SyncMonitor";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import SystemOverview from "@/pages/SystemOverview";

// Company Portal (Independent companies — separate auth, no admin session required)
import CompanyPortalLogin from "@/pages/portal/CompanyPortalLogin";
import CompanyPortalDashboard from "@/pages/portal/CompanyPortalDashboard";
import CompanyPortalCustomers from "@/pages/portal/CompanyPortalCustomers";
import CompanyPortalPickups from "@/pages/portal/CompanyPortalPickups";
import CompanyPortalBillingRecords from "@/pages/portal/CompanyPortalBillingRecords";
import CompanyPortalBatchInvoice from "@/pages/portal/CompanyPortalBatchInvoice";
import CompanyPortalWebhooks from "@/pages/portal/CompanyPortalWebhooks";
import CompanyPortalSettings from "@/pages/portal/CompanyPortalSettings";
import CompanyPortalFixedBilling from "@/pages/portal/CompanyPortalFixedBilling";
import { CompanyPortalProvider } from "@/contexts/CompanyPortalContext";
import FixedBilling from "@/pages/FixedBilling";
import MonthlyBilling from "@/pages/MonthlyBilling";

import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      {/* ─── Admin auth ─── */}
      <Route path="/login" component={SimpleLogin} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* ─── Company Portal (PIN-based, no admin session needed) ─── */}
      <Route path="/company-portal">
        <CompanyPortalProvider>
          <CompanyPortalLogin />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/dashboard">
        <CompanyPortalProvider>
          <CompanyPortalDashboard />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/customers">
        <CompanyPortalProvider>
          <CompanyPortalCustomers />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/pickups">
        <CompanyPortalProvider>
          <CompanyPortalPickups />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/invoices">
        <CompanyPortalProvider>
          <CompanyPortalBillingRecords mode="invoices" />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/payments">
        <CompanyPortalProvider>
          <CompanyPortalBillingRecords mode="payments" />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/batch-invoice">
        <CompanyPortalProvider>
          <CompanyPortalBatchInvoice />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/webhooks">
        <CompanyPortalProvider>
          <CompanyPortalWebhooks />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/settings">
        <CompanyPortalProvider>
          <CompanyPortalSettings />
        </CompanyPortalProvider>
      </Route>
      <Route path="/company-portal/fixed-billing">
        <CompanyPortalProvider>
          <CompanyPortalFixedBilling />
        </CompanyPortalProvider>
      </Route>

      {/* ─── Admin dashboard (session-protected) ─── */}
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
      <Route path="/lots">
        <ProtectedRoute>
          <LotsManagement />
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
      <Route path="/billing-reconciliation">
        <ProtectedRoute>
          <BillingReconciliation />
        </ProtectedRoute>
      </Route>
      <Route path="/batch-reinvoice">
        <ProtectedRoute>
          <BatchReinvoice />
        </ProtectedRoute>
      </Route>
      <Route path="/fixed-billing">
        <ProtectedRoute>
          <FixedBilling />
        </ProtectedRoute>
      </Route>
      <Route path="/monthly-billing">
        <ProtectedRoute>
          <MonthlyBilling />
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
      <Route path="/customer-app">
        <ProtectedRoute>
          <CustomerApp />
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
      <Route path="/system-overview">
        <SuperAdminRoute>
          <SystemOverview />
        </SuperAdminRoute>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

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
