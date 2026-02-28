"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, UserRoundPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import {
  fetchRegistrationStatus,
  loginWithCredentials,
  registerWithCredentials,
} from "@/lib/services/auth-api.service"

type AuthMode = "login" | "register"

type LoginPageClientProps = {
  nextParam?: string
}

const DEFAULT_REDIRECT_PATH = "/mapa"

function resolveNextPath(nextParam: string | undefined) {
  if (!nextParam) return DEFAULT_REDIRECT_PATH
  if (!nextParam.startsWith("/") || nextParam.startsWith("//")) return DEFAULT_REDIRECT_PATH
  if (nextParam.startsWith("/login")) return DEFAULT_REDIRECT_PATH
  return nextParam
}

export default function LoginPageClient({ nextParam }: LoginPageClientProps) {
  const router = useRouter()
  const nextPath = useMemo(() => resolveNextPath(nextParam), [nextParam])

  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingRegistrationStatus, setIsCheckingRegistrationStatus] = useState(true)
  const [canRegister, setCanRegister] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const clearMessages = () => {
    setErrorMessage(null)
    setInfoMessage(null)
  }

  useEffect(() => {
    let isMounted = true

    const loadRegistrationStatus = async () => {
      try {
        const response = await fetchRegistrationStatus()
        if (!isMounted) return

        const nextCanRegister = !response.hasRegisteredUser
        setCanRegister(nextCanRegister)
        if (!nextCanRegister) {
          setMode("login")
        }
      } catch {
        if (!isMounted) return
        setCanRegister(true)
      } finally {
        if (isMounted) {
          setIsCheckingRegistrationStatus(false)
        }
      }
    }

    void loadRegistrationStatus()

    return () => {
      isMounted = false
    }
  }, [])

  const onLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    setIsSubmitting(true)

    try {
      await loginWithCredentials(email, password)
      router.replace(nextPath)
    } catch (error) {
      setErrorMessage(getBackendErrorMessage(error, "No se pudo iniciar sesion."))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()

    if (password !== confirmPassword) {
      setErrorMessage("Las contrasenas no coinciden.")
      return
    }

    setIsSubmitting(true)

    try {
      await registerWithCredentials(email, password)
      setInfoMessage("Cuenta creada. Iniciando sesion...")
      await loginWithCredentials(email, password)
      router.replace(nextPath)
    } catch (error) {
      setErrorMessage(getBackendErrorMessage(error, "No se pudo registrar la cuenta."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(0.88_0.04_75),transparent_45%),radial-gradient(circle_at_80%_80%,oklch(0.84_0.06_55),transparent_40%)]" />

      <div className="parchment relative z-10 w-full max-w-md rounded-md border p-6 shadow-lg">
        <div className="mb-5 text-center">
          <h1 className="font-serif text-3xl text-primary">DM Codex</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inicia sesion para acceder a personajes, edificios y organizaciones.
          </p>
        </div>

        {isCheckingRegistrationStatus ? (
          <p className="mt-2 text-center text-sm text-muted-foreground">Verificando estado de cuenta...</p>
        ) : canRegister ? (
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as AuthMode)
              clearMessages()
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="gap-2">
                <ShieldCheck className="size-4" />
                Ingresar
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-2">
                <UserRoundPlus className="size-4" />
                Registrar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form className="space-y-3" onSubmit={onLoginSubmit}>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  required
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Contrasena"
                  autoComplete="current-password"
                  required
                />
                <Button className="w-full" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Ingresando..." : "Iniciar sesion"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              <form className="space-y-3" onSubmit={onRegisterSubmit}>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  required
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Contrasena"
                  autoComplete="new-password"
                  required
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeti la contrasena"
                  autoComplete="new-password"
                  required
                />
                <Button className="w-full" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Registrando..." : "Registrar cuenta"}
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                El backend solo permite un usuario. Si ya existe, vas a ver un mensaje de conflicto.
              </p>
            </TabsContent>
          </Tabs>
        ) : (
          <form className="space-y-3" onSubmit={onLoginSubmit}>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contrasena"
              autoComplete="current-password"
              required
            />
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ingresando..." : "Iniciar sesion"}
            </Button>
          </form>
        )}

        {errorMessage && <p className="mt-4 text-sm text-destructive">{errorMessage}</p>}
        {infoMessage && <p className="mt-4 text-sm text-primary">{infoMessage}</p>}
      </div>
    </div>
  )
}
