export const site = {
  name: "Drawing2CAD",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Upload a PDF, photo or DWG of a part drawing and get a 3D STEP model back in minutes. Preview it in the browser, then open it in any CAD tool.",
  supportEmail: "support@drawing2cad.com",
  maxUploadMB: 50,
  signupCoins: 20,
} as const;

export const acceptedFiles = {
  // extension -> source kind stored on the job
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  dwg: "dwg",
  dxf: "dxf",
} as const;

export type SourceKind = (typeof acceptedFiles)[keyof typeof acceptedFiles];

export const acceptAttr = ".pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf";
