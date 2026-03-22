import Stars from '@/components/Stars'
import Blackhole from '@/components/Blackhole'
import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'

export default function Home() {
  return (
    <main style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <Stars />
      <Blackhole />
      <Navbar />
      <HeroSection />
    </main>
  )
}