import { backendRequest, clearBackendXsrfToken } from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"

export type AuthUser = {
  id: number
  email: string
}

type RegisterResponse = {
  message: string
  email?: string
}

type RegistrationStatusResponse = {
  hasRegisteredUser: boolean
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function toBasicAuthHeader(email: string, password: string) {
  const encoded = encodeBase64Utf8(`${email}:${password}`)
  return `Basic ${encoded}`
}

export async function loginWithCredentials(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedPassword = password.trim()
  if (!normalizedEmail || !normalizedPassword) {
    throw new Error("Email y contrasena son obligatorios.")
  }

  return backendRequest<AuthUser>(backendRoutes.auth.login, {
    headers: {
      Authorization: toBasicAuthHeader(normalizedEmail, normalizedPassword),
    },
    skipAuthRedirect: true,
  })
}

export async function registerWithCredentials(
  email: string,
  password: string,
): Promise<RegisterResponse> {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedPassword = password.trim()
  if (!normalizedEmail || !normalizedPassword) {
    throw new Error("Email y contrasena son obligatorios.")
  }

  return backendRequest<RegisterResponse>(backendRoutes.auth.register, {
    method: "POST",
    body: {
      email: normalizedEmail,
      password: normalizedPassword,
    },
    skipAuthRedirect: true,
  })
}

export async function fetchRegistrationStatus(): Promise<RegistrationStatusResponse> {
  return backendRequest<RegistrationStatusResponse>(backendRoutes.auth.registrationStatus, {
    skipAuthRedirect: true,
  })
}

export async function logoutCurrentUser(): Promise<void> {
  try {
    await backendRequest<{ message: string }>(backendRoutes.auth.logout, {
      method: "POST",
      skipAuthRedirect: true,
    })
  } finally {
    clearBackendXsrfToken()
  }
}
