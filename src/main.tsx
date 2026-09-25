import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Templates = lazy(() => import("./pages/Templates.tsx"));
const NewTemplate = lazy(() => import("./pages/NewTemplate.tsx"));
const TemplateEditor = lazy(() => import("./pages/TemplateEditor.tsx"));
const Certificates = lazy(() => import("./pages/Certificates.tsx"));
const CertificateCreate = lazy(() => import("./pages/CertificateCreate.tsx"));
const CertificateDetail = lazy(() => import("./pages/CertificateDetail.tsx"));
const BulkCreate = lazy(() => import("./pages/BulkCreate.tsx"));
const BulkJobDetail = lazy(() => import("./pages/BulkJobDetail.tsx"));
const Reports = lazy(() => import("./pages/Reports.tsx"));
const AuditLogs = lazy(() => import("./pages/AuditLogs.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Verify = lazy(() => import("./pages/Verify.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Authenticated route: requires sign-in and renders inside the admin shell. */
function DashboardRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <DashboardLayout>{children}</DashboardLayout>
    </RequireAuth>
  );
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
                <Route path="/verify" element={<Verify />} />
                <Route path="/verify/:certificateId" element={<Verify />} />

                {/* Authenticated admin area */}
                <Route path="/dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
                <Route path="/templates" element={<DashboardRoute><Templates /></DashboardRoute>} />
                <Route path="/templates/new" element={<DashboardRoute><NewTemplate /></DashboardRoute>} />
                <Route path="/templates/:id/edit" element={<DashboardRoute><TemplateEditor /></DashboardRoute>} />
                <Route path="/certificates" element={<DashboardRoute><Certificates /></DashboardRoute>} />
                <Route path="/certificates/new" element={<DashboardRoute><CertificateCreate /></DashboardRoute>} />
                <Route path="/certificates/:id" element={<DashboardRoute><CertificateDetail /></DashboardRoute>} />
                <Route path="/bulk" element={<DashboardRoute><BulkCreate /></DashboardRoute>} />
                <Route path="/bulk/:jobId" element={<DashboardRoute><BulkJobDetail /></DashboardRoute>} />
                <Route path="/reports" element={<DashboardRoute><Reports /></DashboardRoute>} />
                <Route path="/audit" element={<DashboardRoute><AuditLogs /></DashboardRoute>} />
                <Route path="/settings" element={<DashboardRoute><Settings /></DashboardRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </ConvexAuthProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
