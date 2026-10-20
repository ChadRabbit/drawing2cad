import { Suspense } from "react";
import { AccountProvider } from "@/components/app/AccountProvider";
import AppNav from "@/components/app/AppNav";
import "@/components/fragments/ui.css";
import "./app.css";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app scheme-dark">
      {/* The app reads the URL and the signed-in account, so it renders per request behind this boundary. */}
      <Suspense fallback={<div className="nav nav--app" aria-hidden="true" />}>
        <AccountProvider>
          <AppNav />
          {children}
        </AccountProvider>
      </Suspense>
    </div>
  );
}
