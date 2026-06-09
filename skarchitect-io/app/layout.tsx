import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SKArchitect — Sovereign Civic Participation",
  description:
    "A sovereign republic where humans and AI collaborate as partners to shape collective direction.",
  metadataBase: new URL("https://skarchitect.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SKArchitect",
    description:
      "Sovereign civic participation for human-AI republics. Submit proposals, vote, delegate, build the future together.",
    url: "https://skarchitect.io",
    siteName: "SKArchitect",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SKArchitect — Sovereign Civic Participation",
    description:
      "Sovereign civic participation for human-AI republics. Submit proposals, vote, delegate, build the future together.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://smilintux.github.io/#organization",
      "name": "smilinTux",
      "url": "https://smilintux.org",
      "logo": {
        "@type": "ImageObject",
        "url": "https://smilintux.org/img/king-divad.svg",
        "width": 512,
        "height": 512,
      },
      "sameAs": ["https://github.com/smilinTux"],
      "description":
        "Sovereign AI infrastructure — building open, authentic, human-first technology. Home of the Pengu Empire.",
      "foundingDate": "2024",
      "knowsAbout": [
        "Sovereign AI",
        "AI agent infrastructure",
        "Open source security",
        "Persistent AI memory",
        "Decentralized identity",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://skarchitect.io/#website",
      "name": "SKArchitect",
      "url": "https://skarchitect.io",
      "publisher": { "@id": "https://smilintux.github.io/#organization" },
      "inLanguage": "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://skarchitect.io/#app",
      "name": "SKArchitect",
      "description":
        "Sovereign civic participation for human-AI republics. Submit proposals, vote, delegate, and build the future together with DID-based identity and Ed25519-signed ballots.",
      "url": "https://skarchitect.io",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Web",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      "license": "https://www.gnu.org/licenses/gpl-3.0.en.html",
      "isPartOf": {
        "@type": "SoftwareApplication",
        "name": "SKWorld",
        "url": "https://skworld.io",
      },
      "publisher": { "@id": "https://smilintux.github.io/#organization" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-950 text-zinc-100 antialiased`}
      >
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
