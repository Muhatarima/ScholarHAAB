import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ['/', '/dashboard', '/login', '/signup', '/qbank', '/qbank/search', '/qbank/progress', '/onboarding']

  return staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: (route === '/' ? 'daily' : 'weekly') as 'daily' | 'weekly',
    priority: route === '/' ? 1 : 0.7,
  }))
}
