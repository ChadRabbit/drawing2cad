import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPanel from "./LoginPanel";
import "./login.css";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="login scheme-dark">
      <Suspense>
        <LoginPanel />
      </Suspense>
    </main>
  );
}
