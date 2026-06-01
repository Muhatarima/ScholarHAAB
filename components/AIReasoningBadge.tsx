import Badge from '@/components/Badge'

export default function AIReasoningBadge({ label = 'AI reasoning - verify before exam' }: { label?: string }) {
  return <Badge tone="amber">{label}</Badge>
}
