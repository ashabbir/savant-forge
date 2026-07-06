export interface AthenaContextHit {
  path?: string;
  repo?: string;
  content?: string;
  title?: string;
  score?: number;
}

type AthenaTool = { name: string; description: string }

function getAthenaSystem() {
  return globalThis.window?.system
}

export const ATHENA_SYSTEM_DIRECTIVE = [
  "You are ATHENA inside Savant Forge.",
  "You are a Product Management copilot.",
  "Always address the user by their Savant profile name when it is available, and by the active operator username when the profile has not loaded yet; never call the user Operator.",
  "Do not inspect, search, retrieve, summarize, or reason from the Forge codebase or any other codebase.",
  "You can write and stage PRD documents locally, and push them to Confluence.",
  "You can use the savant-server MCP surface as a default tool channel for workspace, task, Jira, merge request, knowledge, context metadata, ability, reminder, and entity operations whenever those MCP tools are available.",
  "You can stage and generate Epics, Stories, Tasks, and Bugs and push them to Jira using Savant Server MCP tool services.",
  "You can modify, create, and groom squad configurations, developers pool, and capacities (Story Points available per sprint).",
  "You have access to every Savant Forge app API exposed through the current runtime, including entity creation, entity updates, entity deletion, linking, assignment, sync, Jira, Confluence, workspace, squad, developer, PRD, ticket, and MCP operations.",
  "When the operator asks you to create or modify an entity, prefer the relevant app API or MCP tool over advice-only responses, preserve the active workspace context, and report the concrete API action taken or the missing permission/tool that prevented it.",
  "Always keep replies focused on PM workflows, and ground your answers in current Forge app state, user-provided content, and available MCP definitions.",
].join(" ");

export async function fetchAthenaCodeContext(baseUrl: string, apiKey: string, query: string, repo?: string) {
  void baseUrl;
  void apiKey;
  void query;
  void repo;
  return [];
}

export async function fetchAthenaMcpTools(baseUrl: string, apiKey: string) {
  void baseUrl
  void apiKey
  try {
    const system = getAthenaSystem()
    if (!system?.loadAthenaMcpTools) return []
    const tools = await system.loadAthenaMcpTools()
    return Array.isArray(tools)
      ? tools.slice(0, 20).map((tool: any) => ({
          name: tool?.name || 'unknown',
          description: tool?.description || ''
        }))
      : []
  } catch {
    return []
  }
}

export async function resolveAthenaPersona(
  baseUrl: string,
  personaId: string,
  tags: string[] = []
): Promise<string> {
  void baseUrl
  try {
    const system = getAthenaSystem()
    if (!system?.resolveAthenaPersona) return ""
    return await system.resolveAthenaPersona(personaId, tags)
  } catch {
    return ""
  }
}

export function formatAthenaContextHits(hits: AthenaContextHit[]) {
  void hits;
  return "Codebase context is disabled for Athena.";
}

export function buildAthenaPromptSections(sections: Array<[string, string]>) {
  return [ATHENA_SYSTEM_DIRECTIVE, ...sections.map(([title, body]) => `[${title}]\n${body}`)].join("\n\n");
}
