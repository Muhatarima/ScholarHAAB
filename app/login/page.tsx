import AuthPage from '@/components/AuthPage'
import { signIn, signInWithGoogle } from '@/app/auth/actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams

  return <AuthPage action={signIn} mode="login" nextPath={params.next ?? '/qbank'} oauthAction={signInWithGoogle} />
}
