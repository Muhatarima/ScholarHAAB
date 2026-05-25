import AuthGuard from '@/components/auth/AuthGuard'
import ProductChatShell from '@/components/ProductChatShell'

export default function QBankPage() {
  return (
    <AuthGuard>
      <ProductChatShell product="qbank" />
    </AuthGuard>
  )
}
