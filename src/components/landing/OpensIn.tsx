const PROGRAMS = ["SolidWorks", "Fusion", "Inventor", "Creo", "CATIA", "NX", "FreeCAD"];

export default function OpensIn() {
  return (
    <section className="opens scheme-light" aria-label="Programs that open the STEP files">
      <p className="opens__lead" data-reveal="">
        Opens in
      </p>
      <ul className="opens__list">
        {PROGRAMS.map((p, i) => (
          <li key={p} data-reveal="" style={{ ["--i" as string]: i }}>
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}
