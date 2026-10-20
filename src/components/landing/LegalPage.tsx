import type { ReactNode } from "react";
import SiteNav from "./SiteNav";
import "./legal.css";

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="legal scheme-dark">
      <SiteNav inApp />
      <main className="legal__main">
        <h1 className="legal__title">{title}</h1>
        <p className="legal__updated">Last updated {updated}</p>
        <div className="legal__body">{children}</div>
      </main>
    </div>
  );
}
