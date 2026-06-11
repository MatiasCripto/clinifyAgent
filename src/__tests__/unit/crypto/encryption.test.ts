import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt } from '@/lib/crypto/encryption'

const HEX_KEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' // 32 bytes hex

describe('encrypt / decrypt', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = HEX_KEY
  })

  it('encrypts and decrypts a string (roundtrip)', () => {
    const original = 'sk-my-secret-api-key-12345'
    const encrypted = encrypt(original)
    expect(encrypted).toMatch(/^enc:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('returns plain text as-is (backward compatibility)', () => {
    const result = decrypt('sk-plain-text-api-key')
    expect(result).toBe('sk-plain-text-api-key')
  })

  it('throws when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY')
  })

  it('throws on invalid encrypted payload format', () => {
    expect(() => decrypt('enc:tooshort')).toThrow('Invalid encrypted payload format')
    expect(() => decrypt('enc:')).toThrow('Invalid encrypted payload format')
  })

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const a = encrypt('hello')
    const b = encrypt('hello')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe('hello')
    expect(decrypt(b)).toBe('hello')
  })

  it('accepts an arbitrary passphrase as ENCRYPTION_KEY', () => {
    process.env.ENCRYPTION_KEY = 'my-arbitrary-passphrase-that-works-too'
    const encrypted = encrypt('some-key')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe('some-key')
  })

  it('handles empty string', () => {
    const encrypted = encrypt('')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe('')
  })

  it('handles special characters', () => {
    const original = '!@#$%^&*()_+ñáéíóú你好'
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })
})
