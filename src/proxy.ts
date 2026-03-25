import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Fast-path auth gate for protected routes.
  // Avoids network/DB calls in middleware, which add significant latency on every navigation.
  const protectedPaths = [
    "/dashboard",
    "/manage",
    "/my",
    "/messages",
    "/notifications",
    "/system",
    "/emails",
    "/posts",
  ];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!isProtectedPath) {
    return NextResponse.next({ request });
  }

  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        (cookie.name.includes("auth-token") || cookie.name.includes("refresh-token"))
    );

  if (!hasSupabaseAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/manage/:path*",
    "/my/:path*",
    "/messages/:path*",
    "/notifications/:path*",
    "/system/:path*",
    "/emails/:path*",
    "/posts/:path*",
  ],
};
