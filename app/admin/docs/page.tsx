'use client'

import React, { useEffect, useState } from 'react'
import { getDocSections, getDocSettings, updateDocSettings, createDocSection, updateDocSection, deleteDocSection } from '../../docs/actions'
import type { DocCategory, DocSection, DocSettings } from '@/types/docs'
import { LucideSettings, LucidePlus, LucideEdit, LucideTrash, LucideSave, LucideEye, LucideClock } from 'lucide-react'
import '../../docs/docs.css'

export default function AdminDocsPage() {
  const [settings, setSettings] = useState<DocSettings | null>(null)
  const [sections, setSections] = useState<DocSection[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSection, setEditingSection] = useState<Partial<DocSection> | null>(null)

  useEffect(() => {
    async function load() {
      const [s, sec] = await Promise.all([getDocSettings(), getDocSections()])
      setSettings(s)
      setSections(sec)
      setLoading(false)
    }
    load()
  }, [])

  const handleTogglePublic = async () => {
    if (!settings) return
    const newStatus = !settings.is_public
    setSettings({ ...settings, is_public: newStatus })
    await updateDocSettings({ is_public: newStatus })
  }

  const handleUpdateSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const updates = {
      start_time: formData.get('start_time') as string,
      end_time: formData.get('end_time') as string
    }
    await updateDocSettings(updates)
    alert('Schedule updated')
  }

  const handleSaveSection = async () => {
    if (!editingSection) return
    if (editingSection.id) {
      await updateDocSection(editingSection.id, editingSection)
    } else {
      const sectionInput: Omit<DocSection, 'id' | 'updated_at'> = {
        slug: editingSection.slug ?? '',
        title: editingSection.title ?? '',
        content: editingSection.content ?? '',
        section_order: editingSection.section_order ?? sections.length + 1,
        category: editingSection.category ?? 'pitch',
        is_active: editingSection.is_active ?? true,
      }
      await createDocSection(sectionInput)
    }
    window.location.reload()
  }

  if (loading) return <div style={{padding: '2rem'}}>Loading admin...</div>

  return (
    <div style={{background: '#0a0a0f', minHeight: '100vh', padding: '3rem', color: '#fff'}}>
      <div style={{maxWidth: '1200px', margin: '0 auto'}}>
        <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem'}}>
          <div>
            <h1 style={{fontSize: '2.5rem', fontWeight: 800}}>Docs Manager</h1>
            <p style={{color: '#94a3b8'}}>Control public visibility, scheduling, and content.</p>
          </div>
          <div style={{display: 'flex', gap: '1rem'}}>
            <a href="/docs" target="_blank" className="navLink" style={{background: 'rgba(255,255,255,0.05)'}}>
              <LucideEye size={18} /> View Live Docs
            </a>
          </div>
        </header>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem'}}>
          {/* Settings Sidebar */}
          <aside>
            <div className="pitchCard" style={{padding: '2rem', marginBottom: '2rem'}}>
              <h2 style={{fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <LucideSettings size={20} /> Visibility
              </h2>
              
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem'}}>
                <span>Publicly Accessible</span>
                <button 
                  onClick={handleTogglePublic}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '20px',
                    border: 'none',
                    background: settings?.is_public ? '#22c55e' : '#475569',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {settings?.is_public ? 'ON' : 'OFF'}
                </button>
              </div>

              <h2 style={{fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <LucideClock size={20} /> Schedule Window
              </h2>
              <form onSubmit={handleUpdateSchedule} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                <label>
                  <span style={{fontSize: '0.8rem', opacity: 0.6}}>Start Date/Time</span>
                  <input 
                    name="start_time" 
                    type="datetime-local" 
                    defaultValue={settings?.start_time?.slice(0, 16)} 
                    style={{width: '100%', padding: '0.75rem', background: '#1e1e30', border: '1px solid #333', color: '#fff', borderRadius: '8px', marginTop: '0.5rem'}}
                  />
                </label>
                <label>
                  <span style={{fontSize: '0.8rem', opacity: 0.6}}>End Date/Time</span>
                  <input 
                    name="end_time" 
                    type="datetime-local" 
                    defaultValue={settings?.end_time?.slice(0, 16)} 
                    style={{width: '100%', padding: '0.75rem', background: '#1e1e30', border: '1px solid #333', color: '#fff', borderRadius: '8px', marginTop: '0.5rem'}}
                  />
                </label>
                <button type="submit" className="navLink" style={{background: '#7c3aed', color: '#fff', border: 'none', justifyContent: 'center'}}>
                  Save Schedule
                </button>
              </form>
            </div>
          </aside>

          {/* Sections List */}
          <main>
            <div className="pitchCard" style={{padding: '2rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
                <h2 style={{fontSize: '1.5rem', fontWeight: 700}}>Documentation Sections</h2>
                <button onClick={() => setEditingSection({ title: '', slug: '', category: 'tech', content: '', section_order: 0 })} className="navLink" style={{background: 'rgba(124, 58, 237, 0.2)', color: '#a78bfa', border: '1px solid #7c3aed'}}>
                  <LucidePlus size={18} /> Add Section
                </button>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                {sections.map(section => (
                  <div key={section.id} style={{background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)'}}>
                    <div>
                      <div style={{fontWeight: 700}}>{section.title}</div>
                      <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>{section.category.toUpperCase()} • /{section.slug}</div>
                    </div>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button onClick={() => setEditingSection(section)} style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'}} title="Edit"><LucideEdit size={18} /></button>
                      <button onClick={async () => { if(confirm('Delete?')) { await deleteDocSection(section.id); window.location.reload(); } }} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'}} title="Delete"><LucideTrash size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit Modal / Form */}
            {editingSection && (
              <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', zIndex: 100}}>
                <div className="pitchCard" style={{maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto'}}>
                  <h2 style={{marginBottom: '1.5rem'}}>{editingSection.id ? 'Edit Section' : 'New Section'}</h2>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                      <label>
                        <span style={{fontSize: '0.8rem', opacity: 0.6}}>Title</span>
                        <input value={editingSection.title} onChange={e => setEditingSection({...editingSection, title: e.target.value})} style={{width: '100%', padding: '0.75rem', background: '#1e1e30', border: '1px solid #333', color: '#fff', borderRadius: '8px', marginTop: '0.5rem'}} />
                      </label>
                      <label>
                        <span style={{fontSize: '0.8rem', opacity: 0.6}}>Slug</span>
                        <input value={editingSection.slug} onChange={e => setEditingSection({...editingSection, slug: e.target.value})} style={{width: '100%', padding: '0.75rem', background: '#1e1e30', border: '1px solid #333', color: '#fff', borderRadius: '8px', marginTop: '0.5rem'}} />
                      </label>
                    </div>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                      <label>
                        <span style={{fontSize: '0.8rem', opacity: 0.6}}>Category</span>
                        <select value={editingSection.category} onChange={e => setEditingSection({...editingSection, category: e.target.value as DocCategory})} style={{width: '100%', padding: '0.75rem', background: '#1e1e30', border: '1px solid #333', color: '#fff', borderRadius: '8px', marginTop: '0.5rem'}}>
                          <option value="pitch">Pitch Deck</option>
                          <option value="tech">Technical</option>
                        </select>
                      </label>
                      <label>
                        <span style={{fontSize: '0.8rem', opacity: 0.6}}>Order</span>
                        <input type="number" value={editingSection.section_order} onChange={e => setEditingSection({...editingSection, section_order: parseInt(e.target.value)})} style={{width: '100%', padding: '0.75rem', background: '#1e1e30', border: '1px solid #333', color: '#fff', borderRadius: '8px', marginTop: '0.5rem'}} />
                      </label>
                    </div>
                    <label>
                      <span style={{fontSize: '0.8rem', opacity: 0.6}}>Content (HTML/Markdown)</span>
                      <textarea value={editingSection.content} onChange={e => setEditingSection({...editingSection, content: e.target.value})} style={{width: '100%', padding: '0.75rem', background: '#1e1e30', border: '1px solid #333', color: '#fff', borderRadius: '8px', marginTop: '0.5rem', minHeight: '300px', fontFamily: 'monospace'}} />
                    </label>
                    <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                      <button onClick={handleSaveSection} className="navLink" style={{background: '#7c3aed', color: '#fff', border: 'none', flex: 1, justifyContent: 'center'}}>
                        <LucideSave size={18} /> Save Section
                      </button>
                      <button onClick={() => setEditingSection(null)} className="navLink" style={{background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', flex: 1, justifyContent: 'center'}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
