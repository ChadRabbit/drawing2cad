import type { Metadata, Viewport } from "next";
import { Stack_Sans_Headline, Stack_Sans_Text } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const headline = Stack_Sans_Headline({
  variable: "--font-stack-headline",
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
  adjustFontFallback: false,
});

const text = Stack_Sans_Text({
  variable: "--font-stack-text",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name}: engineering drawings to 3D STEP files`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    title: `${site.name}: engineering drawings to 3D STEP files`,
    description: site.description,
    siteName: site.name,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${headline.variable} ${text.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
