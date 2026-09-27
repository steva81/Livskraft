import { withAuth } from "next-auth/middleware"

export default withAuth({ pages: { signIn: "/login" } })

export const config = {
  matcher: [
    "/my-plan/:path*",
    "/account/:path*",
    "/dashboard/:path*",
    "/meals/:path*",
    "/training/:path*",
    "/progress/:path*",
    "/coach/:path*",
    "/profile/:path*",
    "/plan/:path*",
  ],
}
