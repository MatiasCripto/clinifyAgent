import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockProfile = { organization_id: 'org-1', role: 'owner' }

vi.mock('@/lib/supabase/get-profile', () => ({
  getAuthProfile: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-1' },
      profile: mockProfile,
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      },
    })
  ),
}))

const mockEncrypt = vi.fn((s: string) => `enc:encrypted:${s}`)
const mockDecrypt = vi.fn((s: string) => s.replace('enc:encrypted:', ''))

vi.mock('@/lib/crypto/encryption', () => ({
  encrypt: (...args: [string]) => mockEncrypt(...args),
  decrypt: (...args: [string]) => mockDecrypt(...args),
}))

import { GET, PUT } from '@/app/api/settings/ai-config/route'

describe('GET /api/settings/ai-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the AI config from organization settings', async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  settings: {
                    ai: { provider: 'openai', apiKey: 'enc:abc123', model: 'gpt-4o' },
                  },
                },
                error: null,
              })
            ),
          })),
        })),
      })),
    }
    const { getAuthProfile } = await import('@/lib/supabase/get-profile')
    vi.mocked(getAuthProfile).mockResolvedValueOnce({
      user: { id: 'user-1' },
      profile: mockProfile,
      admin,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider).toBe('openai')
    expect(body.apiKey).toBe('enc:abc123')
    expect(body.model).toBe('gpt-4o')
  })

  it('returns empty object when no AI config exists', async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { settings: {} }, error: null })),
          })),
        })),
      })),
    }
    const { getAuthProfile } = await import('@/lib/supabase/get-profile')
    vi.mocked(getAuthProfile).mockResolvedValueOnce({
      user: { id: 'user-1' },
      profile: mockProfile,
      admin,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({})
  })

  it('returns 401 when not authenticated', async () => {
    const { getAuthProfile } = await import('@/lib/supabase/get-profile')
    vi.mocked(getAuthProfile).mockResolvedValueOnce(null)

    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/settings/ai-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('encrypts the apiKey when saving a new key', async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: { settings: {} }, error: null })
            ),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    }
    const { getAuthProfile } = await import('@/lib/supabase/get-profile')
    vi.mocked(getAuthProfile).mockResolvedValueOnce({
      user: { id: 'user-1' },
      profile: mockProfile,
      admin,
    })

    const req = new NextRequest('http://localhost/api/settings/ai-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-my-key', model: 'gpt-4o' }),
    })

    const res = await PUT(req)
    expect(res.status).toBe(200)

    // Verify encrypt was called with the raw key
    expect(mockEncrypt).toHaveBeenCalledWith('sk-my-key')
  })

  it('does not re-encrypt an already encrypted key', async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  settings: {
                    ai: { provider: 'openai', apiKey: 'enc:existing-encrypted', model: 'gpt-4o' },
                  },
                },
                error: null,
              })
            ),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    }
    const { getAuthProfile } = await import('@/lib/supabase/get-profile')
    vi.mocked(getAuthProfile).mockResolvedValueOnce({
      user: { id: 'user-1' },
      profile: mockProfile,
      admin,
    })

    // Only updating provider — apiKey not sent
    const req = new NextRequest('http://localhost/api/settings/ai-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic' }),
    })

    const res = await PUT(req)
    expect(res.status).toBe(200)

    // encrypt should NOT be called since apiKey was not provided
    expect(mockEncrypt).not.toHaveBeenCalled()
  })

  it('returns 400 when no provider is provided', async () => {
    const { getAuthProfile } = await import('@/lib/supabase/get-profile')
    vi.mocked(getAuthProfile).mockResolvedValueOnce({
      user: { id: 'user-1' },
      profile: mockProfile,
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { settings: {} }, error: null })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      },
    })

    const req = new NextRequest('http://localhost/api/settings/ai-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk-key' }),
    })

    const res = await PUT(req)
    expect(res.status).toBe(400)
  })

  it('returns 403 for non-admin roles', async () => {
    const { getAuthProfile } = await import('@/lib/supabase/get-profile')
    vi.mocked(getAuthProfile).mockResolvedValueOnce({
      user: { id: 'user-1' },
      profile: { organization_id: 'org-1', role: 'staff' },
      admin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { settings: {} }, error: null })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      },
    })

    const req = new NextRequest('http://localhost/api/settings/ai-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-key' }),
    })

    const res = await PUT(req)
    expect(res.status).toBe(403)
  })
})
