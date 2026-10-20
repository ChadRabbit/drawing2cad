import Link from "next/link";
import { site } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="footer scheme-dark">
      <div className="footer__support">
        <p className="footer__ask">Questions about a drawing</p>
        <a href={`mailto:${site.supportEmail}`} className="footer__mail link link-under">
          {site.supportEmail}
        </a>
      </div>
      <p className="footer__legal">
        © 2026 {site.name} ·{" "}
        <Link href="/privacy" className="link link-under">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="link link-under">
          Terms
        </Link>{" "}
        · Machining clip by Vandurit inserti,{" "}
        <a className="link link-under" href="https://commons.wikimedia.org/wiki/File:CNC_lathe.webm">
          CC BY 3.0
        </a>
      </p>
    </footer>
  );
}
