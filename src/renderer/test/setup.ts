import { vi } from 'vitest'

class MockStorage implements Storage {
  private store: Record<string, string> = {}

  get length() {
    return Object.keys(this.store).length
  }

  clear() {
    this.store = {}
  }

  getItem(key: string) {
    return this.store[key] !== undefined ? this.store[key] : null
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value)
  }

  removeItem(key: string) {
    delete this.store[key]
  }

  key(index: number) {
    const keys = Object.keys(this.store)
    return keys[index] || null
  }
}

const mockLocalStorage = new MockStorage()

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
})

if (globalThis.window) {
  Object.defineProperty(globalThis.window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  })
}
