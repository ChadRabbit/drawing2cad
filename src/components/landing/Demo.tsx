import LoopVideo from "./LoopVideo";
import { site } from "@/lib/site";

/** The "almost" is set small and knocked out of line, so the claim reads as Perfect at a glance. */
function Almost() {
  return (
    <span className="demo__almost" aria-label="almost">
      {"almost".split("").map((ch, i) => (
        <span key={i} aria-hidden="true" style={{ ["--n" as string]: i }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export default function Demo() {
  return (
    <section id="demo" className="demo scheme-light" aria-labelledby="demo-title">
      <figure className="demo__frame" data-reveal="scale">
        {site.demoVideo ? (
          <video className="demo__video" controls playsInline preload="metadata" poster={site.demoVideo.poster}>
            <source src={site.demoVideo.src} />
          </video>
        ) : (
          <>
            <LoopVideo src="/media/cnc-lathe.webm" poster="/media/cnc-lathe-poster.jpg" width={1280} height={720} className="demo__video demo__video--dim" />
            <figcaption className="demo__soon">
              <span className="demo__play" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <path d="M6 3.5v15l12-7.5z" fill="currentColor" />
                </svg>
              </span>
              Demo video coming soon
            </figcaption>
          </>
        )}
      </figure>
      <div className="demo__head">
        <h2 id="demo-title" className="demo__title" data-reveal="">
          <span className="demo__l">
            <Almost /> Perfect, accurate
          </span>{" "}
          <span className="demo__l">models in minutes</span>
        </h2>
        <p className="demo__line" data-reveal="" style={{ ["--i" as string]: 1 }}>
          Watch a scanned drawing go in and a STEP file come out, dimensions checked against the sheet.
        </p>
      </div>
    </section>
  );
}
