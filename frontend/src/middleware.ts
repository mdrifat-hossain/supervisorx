import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected route paths requiring active authentication
  const isProtected =
    pathname.startsWith("/projects") ||
    pathname.startsWith("/documents") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/minimal-dashboard") ||
    pathname.startsWith("/minimal_dashboard");

  if (isProtected) {
    const sessionToken =
      request.cookies.get("better-auth.session_token")?.value ||
      request.cookies.get("__Secure-better-auth.session_token")?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      // Ensure the browser does not cache the redirect or retain bfcache
      redirectResponse.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
      );
      redirectResponse.headers.set("Pragma", "no-cache");
      redirectResponse.headers.set("Expires", "0");
      return redirectResponse;
    }
  }

  const response = NextResponse.next();
  if (isProtected) {
    // Prevent browser bfcache from displaying sensitive research workspaces after logout
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }
  return response;
}

export const config = {
  matcher: [
    "/projects/:path*",
    "/documents/:path*",
    "/dashboard/:path*",
    "/minimal-dashboard/:path*",
    "/minimal_dashboard/:path*",
  ],
};
