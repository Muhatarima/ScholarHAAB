import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ScholarHAAB',
    short_name: 'ScholarHAAB',
    description: 'A/O Level past-paper solver and AI tutor for Bangladeshi students.',
    start_url: '/chat',
    display: 'standalone',
    background_color: '#00000d',
    theme_color: '#7733cc',
    lang: 'en',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
