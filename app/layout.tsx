import type { Metadata, Viewport } from "next";
import { FlyingPizzas } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Know Your Slice",
  description: "Collect eight slices from eight new friends.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='26'>🍕</text></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFF6E9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Sits behind every `.shell`, so the pizzas drift across all screens. */}
        <FlyingPizzas />
        {children}
      </body>
    </html>
  );
}
