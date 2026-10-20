import type { Metadata } from "next";
import LegalPage from "@/components/landing/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="21 October 2026">
      <p>
        This policy explains what {site.name} collects when you use the service, why, and what you can ask us to do with it. Drawings are
        often confidential, so we keep this short and specific.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your Google account’s name, email address and profile picture, when you sign in.</li>
        <li>The drawings you upload, the notes you add, and the 3D models we make from them.</li>
        <li>Your coin balance and its history, and records of the packs you buy (amount, currency, date, Razorpay order and payment IDs).</li>
        <li>Basic technical records needed to run the site securely, such as request logs.</li>
      </ul>
      <p>We never see or store your card, UPI or bank details; Razorpay handles payments under its own policy.</p>
      <h2>How we use it</h2>
      <ul>
        <li>To read your drawing, price it, build the model and show it to you.</li>
        <li>To keep your account, coins and history working, and to answer you when you write to us.</li>
        <li>To prevent abuse of free coins and payments.</li>
        <li>To improve the service, including training and testing the technology that reads drawings and builds models.</li>
      </ul>
      <p>
        We never sell your drawings or models, or share them for marketing. A person on our team may look at a drawing to price it, fix a
        failed conversion, answer a question you asked or improve the service.
      </p>
      <h2>Who processes it for us</h2>
      <p>
        We use carefully chosen providers for cloud hosting, database and file storage, AI processing and payments. They process data only to
        provide their service to us, under contracts that keep it confidential. Some of them are outside India; your data is protected the
        same way wherever it is processed.
      </p>
      <h2>How long we keep it</h2>
      <p>
        Drawings and models are kept with your account, so your history stays complete and every model can be downloaded again. If you want
        your whole account deleted, email us and we’ll remove it within 30 days, apart from payment records we must keep by law.
      </p>
      <h2>Cookies</h2>
      <p>We use a cookie to keep you signed in and one to remember your country for pricing. There are no advertising cookies.</p>
      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your data, to correct it, or to delete it. Write to{" "}
        <a className="link link-under" href={`mailto:${site.supportEmail}`}>
          {site.supportEmail}
        </a>
        .
      </p>
    </LegalPage>
  );
}
