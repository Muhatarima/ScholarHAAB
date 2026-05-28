import React from 'react'
import { getDocSections, getDocSettings } from './actions'
import './docs.css'
import LiveStats from '@/components/docs/LiveStats'
import TeamSection from '@/components/docs/TeamSection'
import Link from 'next/link'
import { LucideShield, LucideLayout, LucideZap, LucideUsers, LucideActivity, LucideCode, LucideDatabase, LucideCpu, LucideGlobe } from 'lucide-react'

export const metadata = {
  title: 'ScholarHAAB Documentation & Pitch Deck',
  description: 'Technical documentation and product pitch for ScholarHAAB - AI Powered Exam Prep Platform.',
}

export default async function DocsPage() {
  const settings = await getDocSettings()
  const sections = await getDocSections()

  const now = new Date()
  const isAvailable = settings?.is_public && 
    (!settings.start_time || now >= new Date(settings.start_time)) &&
    (!settings.end_time || now <= new Date(settings.end_time))

  // For Demo/Dev purposes, if no settings found, we might show a default or a warning
  if (!isAvailable && process.env.NODE_ENV === 'production') {
    return (
      <div className="forbidden">
        <LucideShield size={64} color="#7c3aed" />
        <h1>Access Restricted</h1>
        <p>This documentation module is currently scheduled for private review.</p>
        <div className="dateBadge">
          Next Window: June 10, 2026 - June 14, 2026
        </div>
        <Link href="/" style={{marginTop: '2rem', color: '#a78bfa'}}>Back to Home</Link>
      </div>
    )
  }

  const pitchSections = sections.filter(s => s.category === 'pitch')
  const techSections = sections.filter(s => s.category === 'tech')

  return (
    <div className="docsContainer">
      <nav className="sidebar">
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'}}>
          <div style={{width: 32, height: 32, background: 'linear-gradient(45deg, #7c3aed, #db2777)', borderRadius: 8}}></div>
          <span style={{fontWeight: 800, fontSize: '1.2rem'}}>ScholarHAAB</span>
        </div>

        <div>
          <h2>Product Pitch</h2>
          <div className="navSection">
            {pitchSections.map(s => (
              <a key={s.id} href={`#${s.slug}`} className="navLink">
                <LucideLayout size={18} /> {s.title}
              </a>
            ))}
            <a href="#team" className="navLink"><LucideUsers size={18} /> Team</a>
          </div>
        </div>

        <div>
          <h2>Technical Specs</h2>
          <div className="navSection">
            <a href="#live-stats" className="navLink"><LucideActivity size={18} /> Live Metrics</a>
            <a href="#architecture-diagram" className="navLink"><LucideCode size={18} /> Architecture</a>
            {techSections.map(s => (
              <a key={s.id} href={`#${s.slug}`} className="navLink">
                <LucideZap size={18} /> {s.title}
              </a>
            ))}
          </div>
        </div>

        <div style={{marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
          <button onClick={() => window.print()} className="navLink" style={{background: 'rgba(255,255,255,0.05)', width: '100%', border: 'none', cursor: 'pointer'}}>
            <LucideGlobe size={16} /> Export to PDF
          </button>
          <Link href="/admin/docs" className="navLink" style={{opacity: 0.6}}>
            <LucideShield size={16} /> Admin Panel
          </Link>
        </div>
      </nav>

      <main className="content">
        <header style={{marginBottom: '5rem'}}>
          <div className="liveBadge">LIVE SYSTEM DOCUMENTATION</div>
          <h1 className="sectionTitle" style={{fontSize: '4rem', marginTop: '1rem'}}>
            The Future of AI <br />Exam Preparation.
          </h1>
          <p style={{fontSize: '1.25rem', color: '#94a3b8', maxWidth: '600px'}}>
            A comprehensive technical and business overview of the ScholarHAAB ecosystem.
          </p>
        </header>

        {/* Pitch Deck Sections */}
        {pitchSections.map(section => (
          <section key={section.id} id={section.slug} className="section pitchCard">
            <h2 className="sectionTitle" style={{fontSize: '2rem'}}>{section.title}</h2>
            <div className="markdownContent" dangerouslySetInnerHTML={{ __html: section.content }}>
            </div>
          </section>
        ))}

        <section id="team" className="section">
          <h2 className="sectionTitle">Lead Team</h2>
          <TeamSection />
        </section>

        <hr style={{opacity: 0.1, margin: '5rem 0'}} />

        {/* Technical Sections */}
        <section id="live-stats" className="section">
          <h2 className="sectionTitle">Live System Metrics</h2>
          <LiveStats />
        </section>

        <section id="architecture-diagram" className="section">
          <h2 className="sectionTitle">Architecture Diagram</h2>
          <div style={{background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center'}}>
            <svg width="600" height="300" viewBox="0 0 600 300" style={{maxWidth: '100%'}}>
              <rect x="50" y="20" width="120" height="60" rx="10" fill="rgba(124, 58, 237, 0.2)" stroke="#7c3aed" strokeWidth="2" />
              <text x="110" y="55" fill="#fff" textAnchor="middle" fontSize="14">UI (Next.js)</text>
              
              <path d="M110 80 L110 120" stroke="#7c3aed" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
              
              <rect x="50" y="120" width="120" height="60" rx="10" fill="rgba(219, 39, 119, 0.2)" stroke="#db2777" strokeWidth="2" />
              <text x="110" y="155" fill="#fff" textAnchor="middle" fontSize="14">API Layer</text>

              <path d="M170 150 L250 150" stroke="#db2777" strokeWidth="2" fill="none" />
              
              <rect x="250" y="120" width="120" height="60" rx="10" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2" />
              <text x="310" y="155" fill="#fff" textAnchor="middle" fontSize="14">AI Engine</text>

              <path d="M370 150 L450 150" stroke="#10b981" strokeWidth="2" fill="none" />

              <rect x="450" y="120" width="120" height="60" rx="10" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />
              <text x="510" y="155" fill="#fff" textAnchor="middle" fontSize="14">Database</text>

              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                  <path d="M0,0 L10,5 L0,10 Z" fill="#7c3aed" />
                </marker>
              </defs>
            </svg>
            <p style={{marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem'}}>Live architectural flow from request to reasoning.</p>
          </div>
        </section>

        {techSections.map(section => (
          <section key={section.id} id={section.slug} className="section">
            <h2 className="sectionTitle" style={{fontSize: '2.5rem'}}>{section.title}</h2>
            <div className="markdownContent" dangerouslySetInnerHTML={{ __html: section.content }}>
            </div>
          </section>
        ))}

        <footer style={{padding: '5rem 0', opacity: 0.5, textAlign: 'center'}}>
          <p>&copy; 2026 ScholarHAAB. Proprietary and Confidential.</p>
        </footer>
      </main>
    </div>
  )
}
