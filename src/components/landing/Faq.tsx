const QUESTIONS: [string, string][] = [
  [
    "Which files can I upload?",
    "PDF (exported or scanned), PNG, JPG and WEBP images, including a phone photo of a printed sheet, and DWG or DXF files. Up to 50 MB and one part per drawing. If a part runs over two sheets, put them in one PDF.",
  ],
  [
    "How accurate is the model?",
    "The solid is built to the dimensions written on your sheet, not to the length of the lines, and each dimension is measured on the finished model before you see it. If a dimension is missing or contradicts another, the model page says which one and what was assumed.",
  ],
  [
    "How long does a conversion take?",
    "Most parts are ready in a few minutes. Castings and housings with many features take longer. The model page shows each stage as it happens, and the finished model stays in your history.",
  ],
  [
    "What if my drawing can’t be converted?",
    "Most problems show up when we read the sheet, before you pay: the page tells you why, such as a missing view or a scan too faint to read, and nothing is charged. Coins spent on a confirmed conversion aren’t refunded.",
  ],
  [
    "Can it do assemblies or sheet metal?",
    "One solid part per drawing for now. For an assembly, upload each part’s drawing on its own. Sheet metal comes out as the folded solid, without a flat pattern.",
  ],
  [
    "Who can see my drawings?",
    "Files are stored privately against your account and aren’t shared with other users. Every drawing and its model stays in your history, ready to download again.",
  ],
  [
    "Millimetres or inches?",
    "Units are read from the title block and the dimensions. If the sheet doesn’t say, pick millimetres or inches when you upload.",
  ],
  [
    "Which programs open the STEP file?",
    "STEP AP214 opens in SolidWorks, Fusion, Inventor, Creo, CATIA, NX, Onshape and FreeCAD, and in most CAM and 3D-printing software.",
  ],
  ["Do coins expire?", "No. Coins stay on your account until you use them."],
];

export default function Faq() {
  return (
    <section id="questions" className="faq scheme-dark" aria-labelledby="faq-title">
      <h2 id="faq-title" className="faq__title" data-reveal="">
        Questions
      </h2>
      <div className="faq__list">
        {QUESTIONS.map(([q, a], i) => (
          <details key={q} name="faq" className="faq__item" open={i === 0} data-reveal="" style={{ ["--i" as string]: i % 4 }}>
            <summary className="faq__q">
              <span>{q}</span>
              <span className="faq__sign" aria-hidden="true" />
            </summary>
            <div className="faq__a">
              <p>{a}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
