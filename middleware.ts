import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Middleware for Authentication & Route Protection
 *
 * This middleware:
 * - Protects authenticated routes from unauthenticated access
 * - Redirects authenticated users away from auth pages
 * - Maintains Supabase session cookies
 * - Handles authentication state at the edge
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create response object that we can modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on both request and response
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get authenticated user (this also refreshes the session if needed)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define public routes that don't require authentication
  const publicRoutes = ["/", "/login", "/signup", "/auth/callback"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // RULE 1: Protect authenticated routes
  // If user is not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the original destination for redirect after login
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // RULE 2: Redirect authenticated users away from auth pages
  // If user is logged in and trying to access login/signup
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // RULE 3: Handle post-login redirect
  // If user just logged in and there's a redirectTo param
  if (user && pathname === "/dashboard") {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    if (redirectTo && !publicRoutes.some((route) => redirectTo.startsWith(route))) {
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      url.searchParams.delete("redirectTo");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (webpack hot module replacement)
     * - favicon.ico, sitemap.xml, robots.txt (meta files)
     * - Static assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
