import AuthGuard from '@/components/auth/AuthGuard'
import ProductChatShell from '@/components/ProductChatShell'

export default function SolverPage() {
  return (
    <AuthGuard>
      <ProductChatShell product="qbank" />
    </AuthGuard>
  )
}
