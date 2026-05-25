import AuthGuard from '@/components/auth/AuthGuard'

export default function QBankLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
