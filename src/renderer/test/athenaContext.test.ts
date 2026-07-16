import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchAthenaCodeContext,
  fetchAthenaMcpTools,
  formatAthenaContextHits,
  buildAthenaPromptSections,
  ATHENA_SYSTEM_DIRECTIVE,
  resolveAthenaPersona
} from '../services/athenaContext'

describe('athenaContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('window', {
      system: {
        loadAthenaMcpTools: vi.fn(),
        resolveAthenaPersona: vi.fn()
      }
    } as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('fetchAthenaCodeContext', () => {
    it('retrieves indexed Savant context for planning', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ path: 'src/App.tsx', repo: 'savant-forge', content: 'planning UI' }] }), { status: 200 }))
      const result = await fetchAthenaCodeContext('http://localhost', 'key', 'search-term', 'my-repo')
      expect(result).toEqual([{ path: 'src/App.tsx', repo: 'savant-forge', content: 'planning UI' }])
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/context/search?'), expect.objectContaining({ headers: { 'X-API-Key': 'key' } }))
    })
  })

  describe('fetchAthenaMcpTools', () => {
    it('returns mapped tools on success', async () => {
      const mockTools = [
        { name: 'read_file', description: 'reads a file' },
        { name: 'run_command' }
      ]
      vi.mocked(window.system!.loadAthenaMcpTools).mockResolvedValueOnce(mockTools as any)

      const result = await fetchAthenaMcpTools('http://localhost', 'key')

      expect(result.length).toBe(2)
      expect(result[0]).toEqual({ name: 'read_file', description: 'reads a file' })
      expect(result[1]).toEqual({ name: 'run_command', description: '' })
    })

    it('handles flat array formats for tools', async () => {
      const mockTools = [{ name: 'tool-flat' }]
      vi.mocked(window.system!.loadAthenaMcpTools).mockResolvedValueOnce(mockTools as any)

      const result = await fetchAthenaMcpTools('http://localhost', 'key')
      expect(result.length).toBe(1)
      expect(result[0].name).toBe('tool-flat')
    })

    it('returns empty array if fetch fails', async () => {
      vi.mocked(window.system!.loadAthenaMcpTools).mockRejectedValueOnce(new Error('error'))
      const result = await fetchAthenaMcpTools('http://localhost', 'key')
      expect(result).toEqual([])
    })
  })

  describe('formatAthenaContextHits', () => {
    it('formats retrieved context with source labels', () => {
      const hits = [{ path: 'a.js', repo: 'repo', content: 'code-a' }]
      const result = formatAthenaContextHits(hits)
      expect(result).toContain('repo/a.js')
      expect(result).toContain('code-a')
    })
  })

  describe('buildAthenaPromptSections', () => {
    it('formats system directives and appends sections', () => {
      const sections: Array<[string, string]> = [['Section A', 'Content A']]
      const result = buildAthenaPromptSections(sections)
      expect(result).toContain(ATHENA_SYSTEM_DIRECTIVE)
      expect(result).toContain('never call the user Operator')
      expect(result).toContain('Do not inspect, search, retrieve, summarize, or reason from the Forge codebase or any other codebase')
      expect(result).toContain('You can use the savant-server MCP surface as a default tool channel')
      expect(result).toContain('You have access to every Savant Forge app API exposed through the current runtime')
      expect(result).toContain('When the operator asks you to create or modify an entity')
      expect(result).toContain('[Section A]\nContent A')
    })
  })

  describe('resolveAthenaPersona', () => {
    it('returns prompt on success', async () => {
      vi.mocked(window.system!.resolveAthenaPersona).mockResolvedValueOnce('Resolved prompt text')

      const result = await resolveAthenaPersona('http://localhost', 'persona.product', ['product'])
      expect(result).toBe('Resolved prompt text')
    })

    it('falls back to persona on success if prompt is missing', async () => {
      vi.mocked(window.system!.resolveAthenaPersona).mockResolvedValueOnce('Persona only text')

      const result = await resolveAthenaPersona('http://localhost', 'persona.product', ['product'])
      expect(result).toBe('Persona only text')
    })

    it('returns empty string if API call fails', async () => {
      vi.mocked(window.system!.resolveAthenaPersona).mockRejectedValueOnce(new Error('resolve fail'))

      const result = await resolveAthenaPersona('http://localhost', 'persona.product', ['product'])
      expect(result).toBe('')
    })
  })
})
