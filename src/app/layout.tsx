import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// A high-contrast editorial serif against a technical grotesque and a real code
// face: the tool is precise, but it is not a spreadsheet. Same three faces as
// the shape and carousel tools — this is their sibling.
const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const sans = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Screenshot generator — beautiful shots from plain screenshots",
  description:
    "Drop in a screenshot and tilt it in real 3D with camera-real focus blur, neon frames, glows, curated backgrounds and melt-into-light — then download a PNG.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
