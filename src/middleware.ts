// This would protect the dashboard and authcallbackroutes, but it is not working in kinde currently

import { authMiddleware } from "@kinde-oss/kinde-auth-nextjs/server";

export const config = {
  matcher: [],
  // matcher: ['/dashboard/:path*', '/auth-callback'],
};

export default authMiddleware;
