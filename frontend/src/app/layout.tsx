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
  description:
    "Discover candidate papers from arXiv and OpenAlex, extract and analyze PDF methodologies with PyMuPDF, query evidence grounded with section citations, and export structured synthesis reports in PDF and DOCX.",
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
                try {
                  var origDefProp = Object.defineProperty;
                  Object.defineProperty = function(obj, prop, descriptor) {
                    if ((obj === window || (typeof Window !== 'undefined' && obj === Window.prototype)) && prop === 'location') {
                      return obj;
                    }
                    return origDefProp.call(Object, obj, prop, descriptor);
                  };
                } catch (e) {}

                var isExtensionErr = function(str, fn) {
                  var s = String(str || '').toLowerCase();
                  var f = String(fn || '').toLowerCase();
                  return s.indexOf('location') !== -1 || s.indexOf('cently') !== -1 || s.indexOf('redirection') !== -1 || f.indexOf('chrome-extension://') !== -1;
                };

                window.addEventListener('error', function(event) {
                  if (isExtensionErr(event.message, event.filename)) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    return true;
                  }
                }, true);

                window.addEventListener('unhandledrejection', function(event) {
                  if (isExtensionErr(event.reason, '')) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                  }
                }, true);

                var origOnError = window.onerror;
                window.onerror = function(msg, url, line, col, error) {
                  if (isExtensionErr(msg, url)) {
                    return true;
                  }
                if (typeof origOnError === 'function') {
                    return origOnError.apply(this, arguments);
                  }
                };

                window.addEventListener('pageshow', function(event) {
                  if (event.persisted) {
                    window.location.reload();
                  }
                });

                function hideDevOverlay() {
                  var portal = document.querySelector('nextjs-portal');
                  if (portal) {
                    portal.style.setProperty('display', 'none', 'important');
                    if (portal.shadowRoot) {
                      var toast = portal.shadowRoot.querySelector('[data-nextjs-toast], .nextjs-toast-errors-parent');
                      if (toast) toast.style.setProperty('display', 'none', 'important');
                    }
                  }
                  var devScript = document.querySelector('script[data-nextjs-dev-overlay]');
                  if (devScript) {
                    devScript.style.setProperty('display', 'none', 'important');
                  }
                }
                if (typeof window !== 'undefined') {
                  window.addEventListener('DOMContentLoaded', hideDevOverlay);
                  var devObserver = new MutationObserver(hideDevOverlay);
                  devObserver.observe(document.documentElement, { childList: true, subtree: true });
                }
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
