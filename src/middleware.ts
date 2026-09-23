export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/meals/:path*",
    "/training/:path*",
    "/progress/:path*",
    "/coach/:path*",
    "/profile/:path*",
  ],
}
