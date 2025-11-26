import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Protected routes
  const protectedPaths = ["/dashboard", "/admin", "/staff"];
  const authPaths = ["/login", "/signup", "/forgot-password"];
  const onboardingPaths = ["/onboarding"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isOnboardingPath = onboardingPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  let user = null;
  let authError = null;

  // Try to get user with error handling for network failures
  try {
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // "Auth session missing!" is not an error - it just means user is not logged in
      // Only treat actual service errors as authError
      if (error.message !== "Auth session missing!") {
        console.error("Supabase auth error:", error.message);
        authError = error;
      }
    } else {
      user = supabaseUser;
    }
  } catch (error) {
    console.error("Unexpected error checking auth:", error);
    authError = error;
  }

  // If Supabase is unavailable, allow access to auth pages but block protected routes
  if (authError) {
    // Allow access to auth pages when Supabase is down
    if (isAuthPath) {
      return supabaseResponse;
    }

    // Block protected routes with error redirect
    if (isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "auth_service_unavailable");
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Allow access to public routes
    return supabaseResponse;
  }

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Check profile completion for authenticated users accessing protected routes
  if (user && (isProtectedPath && !isOnboardingPath)) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { profileCompletedAt: true },
      });

      // If profile is not complete, redirect to onboarding
      if (dbUser && !dbUser.profileCompletedAt) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding/complete-profile";
        url.searchParams.set("redirectTo", request.nextUrl.pathname);
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error("Error checking profile completion:", error);
      // Allow access on error to avoid blocking users
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
