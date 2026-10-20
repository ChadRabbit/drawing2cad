import Hero from "@/components/landing/Hero";
import SiteNav from "@/components/landing/SiteNav";
import Demo from "@/components/landing/Demo";
import OpensIn from "@/components/landing/OpensIn";
import Pricing, { type ExampleInfo } from "@/components/landing/Pricing";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import Reveal from "@/components/landing/Reveal";
import { getPricing } from "@/lib/pricing-server";
import plate from "../../../public/examples/mounting-plate/info.json";
import pillow from "../../../public/examples/pillow-block/info.json";
import gearbox from "../../../public/examples/gearbox-housing/info.json";
import "./landing.css";

const examples: Record<string, ExampleInfo> = Object.fromEntries(
  [plate, pillow, gearbox].map((e) => [e.id, { ...e, bbox: e.bbox as [number, number, number] }]),
);

export default async function Home() {
  const { tiers, packs } = await getPricing();
  return (
    <>
      <SiteNav />
      <main>
        <Hero example={examples["pillow-block"]} />
        <Demo />
        <OpensIn />
        <Pricing tiers={tiers} packs={packs} examples={examples} />
        <Faq />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
