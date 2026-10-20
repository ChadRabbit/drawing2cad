import type { Metadata } from "next";
import LegalPage from "@/components/landing/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms of service" updated="21 October 2026">
      <p>
        These terms cover your use of {site.name}. By signing in you agree to them. If you use {site.name} for a company, you agree on its
        behalf.
      </p>
      <h2>The service</h2>
      <p>
        You upload a 2D drawing of a part; we price it, and once you confirm, we produce a 3D model of it as a STEP file. One part per
        drawing. We read your drawing as carefully as we can, but a drawing can be ambiguous, incomplete or wrong.
      </p>
      <h2>Check before you make</h2>
      <p>
        You are responsible for checking every model against your requirements before using it to manufacture, quote or certify anything.
        We are not responsible for parts, tooling or material made from a model.
      </p>
      <h2>Your drawings</h2>
      <p>
        Only upload drawings you have the right to use. You keep all rights to your drawings and to the models we make from them. You give
        us permission to process them only to provide the service to you.
      </p>
      <h2>Coins and payments</h2>
      <ul>
        <li>Coins are bought in packs through Razorpay and are used to pay for conversions. They don’t expire.</li>
        <li>A conversion’s price is shown before you confirm it; coins are taken only when you confirm.</li>
        <li>Coins are spent once you confirm a conversion and are not refunded, including when a model can’t be delivered.</li>
        <li>Bought coins can’t be refunded or exchanged for cash, except where the law requires it.</li>
        <li>Free coins given at sign-up or by us have no cash value, and we may limit them to one per person.</li>
      </ul>
      <h2>Fair use</h2>
      <p>
        Don’t misuse the service: no attempts to break or overload it, to get at other people’s files, or to farm free coins with extra
        accounts. We may suspend accounts that do.
      </p>
      <h2>Liability</h2>
      <p>
        The service is provided as is. As far as the law allows, our total liability to you for anything related to the service is limited
        to the amount you paid us in the three months before the claim.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update these terms; if a change matters, we’ll tell you by email before it applies. These terms are governed by the laws of
        India. Questions:{" "}
        <a className="link link-under" href={`mailto:${site.supportEmail}`}>
          {site.supportEmail}
        </a>
        .
      </p>
    </LegalPage>
  );
}
