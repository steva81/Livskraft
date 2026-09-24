import { withAuth } from "next-auth/middleware"

export default withAuth({ pages: { signIn: "/login" } })

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/meals/:path*",
    "/training/:path*",
    "/progress/:path*",
    "/coach/:path*",
    "/profile/:path*",
    "/plan/:path*",
  ],
}
