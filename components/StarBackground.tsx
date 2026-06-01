import StarBackdrop from '@/components/StarBackdrop'

export default function StarBackground({ variant = 'chat' }: { variant?: 'auth' | 'chat' }) {
  return <StarBackdrop variant={variant} />
}
