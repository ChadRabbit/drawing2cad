import Link from "next/link";
import HeroViewer from "./HeroViewer";
import type { ExampleInfo } from "./Pricing";
import { site } from "@/lib/site";

export default function Hero({ example }: { example: ExampleInfo }) {
  return (
    <section className="hero scheme-dark" aria-labelledby="hero-title">
      <div className="hero__left">
        <div className="hero__copy">
          <h1 id="hero-title" className="hero__title lines">
            <span className="line">
              <span data-line="" style={{ ["--i" as string]: 0 }}>
                2D drawings to
              </span>
            </span>
            <span className="line">
              <span data-line="" style={{ ["--i" as string]: 1 }}>
                3D STEP files
              </span>
            </span>
          </h1>
          <p className="hero__lede" data-rise="" style={{ ["--i" as string]: 0 }}>
            Upload a PDF, a photo or a DWG of a part. AI reads every view and dimension and hands back a STEP file in minutes.
          </p>
          <div className="hero__actions" data-rise="" style={{ ["--i" as string]: 1 }}>
            <Link href="/convert" className="btn">
              Convert a drawing
            </Link>
            <span className="hero__note">{site.signupCoins} free coins when you sign in with Google</span>
          </div>
        </div>
      </div>
      <div className="hero__right">
        <HeroViewer example={example} className="hero__frag" />
      </div>
    </section>
  );
}
