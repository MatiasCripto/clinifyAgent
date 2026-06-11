import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockUser = { id: 'user-1', email: 'test@example.com' }
const mockOrg = { id: 'org-1', name: 'Mi Clínica', slug: 'mi-clinica-user-1' }
const mockAdmin = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}

vi.mock('@/lib/supabase/get-profile', () => ({
  getAuthenticatedUser: vi.fn(() => Promise.resolve(mockUser)),
}))

vi.mock('@/lib/supabase/server-admin', () => ({
  createAdminClient: vi.fn(() => mockAdmin),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}))

import { POST } from '@/app/api/auth/onboarding/route'

describe('POST /api/auth/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mockAdmin mocked functions
    const insertChain = {
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: mockOrg, error: null })),
      })),
    }
    const updateChain = vi.fn(() => Promise.resolve({ error: null }))

    mockAdmin.from = vi.fn(() => ({
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => ({ eq: updateChain })),
    }))
  })

  it('creates organization, clinic, and updates profile on success', async () => {
    const req = new NextRequest('http://localhost/api/auth/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: 'Mi Clínica',
        specialty: 'Odontología',
        phone: '+54 11 1234-5678',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.organizationId).toBe('org-1')
  })

  it('returns 400 when clinicName is missing', async () => {
    const req = new NextRequest('http://localhost/api/auth/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specialty: 'Odontología' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('nombre')
  })

  it('returns 401 when user is not authenticated', async () => {
    const { getAuthenticatedUser } = await import('@/lib/supabase/get-profile')
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/auth/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicName: 'Clínica' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('handles DB errors gracefully', async () => {
    const insertChain = {
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })),
      })),
    }
    mockAdmin.from = vi.fn(() => ({ insert: vi.fn(() => insertChain) }))

    const req = new NextRequest('http://localhost/api/auth/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicName: 'Mi Clínica' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
