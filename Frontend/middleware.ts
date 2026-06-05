import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const AUTH_COOKIE_NAME = "JWT-TOKEN"
const LOGIN_PATH = "/login"

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  return atob(padded)
}

function hasUsableJwtToken(token: string | undefined) {
  if (!token) return false

  const parts = token.split(".")
  if (parts.length !== 3) return false

  try {
    const payloadJson = decodeBase64Url(parts[1])
    const payload = JSON.parse(payloadJson) as { exp?: unknown }
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return true
    }
    return payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isBattleUppercasePath = pathname === "/Batalla"

  if (pathname === LOGIN_PATH) {
    return NextResponse.next()
  }

  const jwtToken = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (hasUsableJwtToken(jwtToken)) {
    if (isBattleUppercasePath) {
      const lowercaseUrl = request.nextUrl.clone()
      lowercaseUrl.pathname = "/batalla"
      return NextResponse.redirect(lowercaseUrl)
    }

    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = LOGIN_PATH
  loginUrl.searchParams.set("next", `${isBattleUppercasePath ? "/batalla" : pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
