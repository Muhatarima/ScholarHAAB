import Badge from '@/components/Badge'

export default function VerifiedBadge({ label = 'Verified mark scheme' }: { label?: string }) {
  return <Badge tone="green">{label}</Badge>
}
