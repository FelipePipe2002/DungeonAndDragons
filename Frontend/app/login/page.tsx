import LoginPageClient from "./LoginPageClient"

type LoginPageSearchParams = {
  next?: string | string[]
}

type LoginPageProps = {
  searchParams: Promise<LoginPageSearchParams>
}

function toSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const nextParam = toSingleValue(params.next)
  return <LoginPageClient nextParam={nextParam} />
}
