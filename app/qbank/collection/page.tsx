import { redirect } from 'next/navigation'

export default function QbankCollectionPage() {
  // AuthGuard is enforced by middleware before this legacy redirect.
  redirect('/qbank')
}
