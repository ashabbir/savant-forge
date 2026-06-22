import { describe, expect, it } from 'vitest'
import { appModule } from '../appModule'

describe('appModule', () => {
  it('defines the correct module specifications', () => {
    expect(appModule.id).toBe('forge')
    expect(appModule.subtitle).toContain('Resource & Capability')
    expect(appModule.navigation.length).toBeGreaterThan(0)
    expect(appModule.actions.length).toBeGreaterThan(0)
  })
})
