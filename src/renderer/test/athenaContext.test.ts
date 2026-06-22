import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchAthenaCodeContext,
  fetchAthenaMcpTools,
  formatAthenaContextHits,
  buildAthenaPromptSections,
  ATHENA_SYSTEM_DIRECTIVE
} from '../services/athenaContext'

describe('athenaContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('fetchAthenaCodeContext', () => {
    it('never fetches codebase context', async () => {
      const result = await fetchAthenaCodeContext('http://localhost', 'key', 'search-term', 'my-repo')
      expect(result).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('fetchAthenaMcpTools', () => {
    it('returns mapped tools on success', async () => {
      const mockTools = [
        { name: 'read_file', description: 'reads a file' },
        { name: 'run_command' }
      ]

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tools: mockTools })
      } as Response)

      const result = await fetchAthenaMcpTools('http://localhost', 'key')

      expect(result.length).toBe(2)
      expect(result[0]).toEqual({ name: 'read_file', description: 'reads a file' })
      expect(result[1]).toEqual({ name: 'run_command', description: '' })
    })

    it('handles flat array formats for tools', async () => {
      const mockTools = [{ name: 'tool-flat' }]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTools)
      } as Response)

      const result = await fetchAthenaMcpTools('http://localhost', 'key')
      expect(result.length).toBe(1)
      expect(result[0].name).toBe('tool-flat')
    })

    it('returns empty array if fetch fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('error'))
      const result = await fetchAthenaMcpTools('http://localhost', 'key')
      expect(result).toEqual([])
    })
  })

  describe('formatAthenaContextHits', () => {
    it('reports that codebase context is disabled', () => {
      const hits = [{ path: 'a.js', repo: 'repo', content: 'code-a' }]
      const result = formatAthenaContextHits(hits)
      expect(result).toBe('Codebase context is disabled for Athena.')
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
})
