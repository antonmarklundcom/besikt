export { default } from "next-auth/middleware";

// Protect the dashboard (and its APIs). Public routes — /login, /intake,
// /api/auth, /api/webhook — are intentionally excluded.
export const config = {
  matcher: ["/dashboard/:path*"],
};
