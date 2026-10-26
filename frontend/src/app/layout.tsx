import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SupervisorX | Your AI Research Supervisor",
  description: "Analyze papers, understand code, discover research gaps, and accelerate innovation with a persistent knowledge memory for researchers.",
  icons: {
    icon: [
      { url: "/synergy.png" },
      { url: "/synergy.png", type: "image/png" },
    ],
    shortcut: "/synergy.png",
    apple: "/synergy.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                window.addEventListener('error', function(event) {
                  var fn = event.filename || '';
                  var msg = event.message || '';
                  if (fn.indexOf('chrome-extension://') !== -1 || msg.indexOf('redirection') !== -1 || msg.indexOf('cently') !== -1 || msg.indexOf('location') !== -1) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    return true;
                  }
                }, true);
                window.addEventListener('unhandledrejection', function(event) {
                  var str = String(event.reason || '');
                  if (str.indexOf('chrome-extension://') !== -1 || str.indexOf('redirection') !== -1 || str.indexOf('cently') !== -1 || str.indexOf('location') !== -1) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                  }
                }, true);
              })();
            `,
          }}
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-background text-on-background font-body-md min-h-screen overflow-x-hidden selection:bg-primary/30"
      >
        {children}
      </body>
    </html>
  );
}
