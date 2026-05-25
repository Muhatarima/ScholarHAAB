import AuthPage from '@/components/AuthPage'
import { signInWithGoogle, signUp } from '@/app/auth/actions'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams

  return <AuthPage action={signUp} mode="signup" nextPath={params.next ?? '/qbank'} oauthAction={signInWithGoogle} />
}
