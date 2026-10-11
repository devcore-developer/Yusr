export { auth as middleware } from "@/lib/auth"

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
}