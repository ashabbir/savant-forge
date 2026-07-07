# Graph Report - savant-forge  (2026-06-25)

## Corpus Check
- 47 files · ~52,294 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 472 nodes · 783 edges · 24 communities (21 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1d358ce3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Local State & Sprint Metrics Service|Local State & Sprint Metrics Service]]
- [[_COMMUNITY_Left Rail & Login Components|Left Rail & Login Components]]
- [[_COMMUNITY_Electron Main Process|Electron Main Process]]
- [[_COMMUNITY_Sprint Cockpit & Ticket Modals|Sprint Cockpit & Ticket Modals]]
- [[_COMMUNITY_Sprint Workbench UI Panels|Sprint Workbench UI Panels]]
- [[_COMMUNITY_Settings & Savant Client Integration|Settings & Savant Client Integration]]
- [[_COMMUNITY_Athena AI Store & Memory Management|Athena AI Store & Memory Management]]
- [[_COMMUNITY_Developer Specialties & Squad Stats|Developer Specialties & Squad Stats]]
- [[_COMMUNITY_TypeScript Compiler Configuration|TypeScript Compiler Configuration]]
- [[_COMMUNITY_Electron App Build & Packaging Settings|Electron App Build & Packaging Settings]]
- [[_COMMUNITY_Developer Detail Modal Dialog|Developer Detail Modal Dialog]]
- [[_COMMUNITY_Project Dependencies & Tooling|Project Dependencies & Tooling]]
- [[_COMMUNITY_Sanctum App Design & Layout System|Sanctum App Design & Layout System]]
- [[_COMMUNITY_Athena Context & LLM Prompting|Athena Context & LLM Prompting]]
- [[_COMMUNITY_Test Environments & LocalStorage Mocking|Test Environments & LocalStorage Mocking]]
- [[_COMMUNITY_Module Definition & Navigation System|Module Definition & Navigation System]]
- [[_COMMUNITY_ViteNode TypeScript Configuration|Vite/Node TypeScript Configuration]]
- [[_COMMUNITY_Dev Startup & Electron Spawning|Dev Startup & Electron Spawning]]
- [[_COMMUNITY_Vite Type Declarations|Vite Type Declarations]]
- [[_COMMUNITY_Graphify Knowledge Graph Rules|Graphify Knowledge Graph Rules]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]

## God Nodes (most connected - your core abstractions)
1. `JiraTicketDB` - 21 edges
2. `Forge Style Guide` - 18 edges
3. `compilerOptions` - 16 edges
4. `16. Visual Examples` - 13 edges
5. `JiraTicket` - 12 edges
6. `build` - 10 edges
7. `Squad` - 10 edges
8. `getStoredApiKey()` - 10 edges
9. `buildSquadSnapshot()` - 9 edges
10. `scripts` - 8 edges

## Surprising Connections (you probably didn't know these)
- `AddTicketModalProps` --references--> `JiraTicket`  [EXTRACTED]
  src/renderer/components/AddTicketModal.tsx → src/renderer/services/localState.ts
- `createBlankDeveloperDraft()` --calls--> `describeSpecialties()`  [EXTRACTED]
  src/renderer/App.tsx → src/renderer/components/DeveloperSpecialties.tsx
- `createBlankDeveloperDraft()` --calls--> `normalizeSpecialtyTags()`  [EXTRACTED]
  src/renderer/App.tsx → src/renderer/components/DeveloperSpecialties.tsx
- `fromDeveloper()` --calls--> `describeSpecialties()`  [EXTRACTED]
  src/renderer/App.tsx → src/renderer/components/DeveloperSpecialties.tsx
- `fromDeveloper()` --calls--> `normalizeSpecialtyTags()`  [EXTRACTED]
  src/renderer/App.tsx → src/renderer/components/DeveloperSpecialties.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sanctum Design System Guidelines** — style_guide_app_shell, style_guide_visual_system, style_guide_typography, style_guide_color_palette, style_guide_right_rail_drawer [EXTRACTED 0.95]

## Communities (24 total, 3 thin omitted)

### Community 0 - "Local State & Sprint Metrics Service"
Cohesion: 0.07
Nodes (53): buildSquadSnapshot(), CompanyHoliday, computeCarryoverPoints(), computeDeveloperAvailability(), computeVelocity(), countEventDays(), createTicketLocal(), DEFAULT_WORKING_DAYS (+45 more)

### Community 1 - "Left Rail & Login Components"
Cohesion: 0.07
Nodes (18): describeSpecialties(), normalizeSpecialtyTags(), LeftRail(), LeftRailProps, LoginScreen(), LoginScreenProps, LogoutConfirmModal(), LogoutConfirmModalProps (+10 more)

### Community 2 - "Electron Main Process"
Cohesion: 0.04
Nodes (44): createTray(), createWindow(), resolveAsset(), SavantShellConfig, shellConfig, author, dependencies, lucide-react (+36 more)

### Community 3 - "Sprint Cockpit & Ticket Modals"
Cohesion: 0.06
Nodes (31): AddTicketModal(), AddTicketModalProps, PMPanelProps, PMView, ProductManagerPanel(), fieldLabelStyle, inlineButtonStyle(), inputStyle (+23 more)

### Community 4 - "Sprint Workbench UI Panels"
Cohesion: 0.08
Nodes (16): badgeStyle, bandHeaderStyle, eventRowStyle, inputStyle, metricStyle, monoLabelStyle, plusDays(), primaryButtonStyle (+8 more)

### Community 5 - "Settings & Savant Client Integration"
Cohesion: 0.19
Nodes (19): SettingsModal(), SettingsModalProps, ForgeConfig, appendAuthHeader(), checkGatewayHealth(), checkServerHealth(), ConnectionStatus, fetchJson() (+11 more)

### Community 6 - "Athena AI Store & Memory Management"
Cohesion: 0.05
Nodes (41): 10. Motion, 11. Forge-Specific Product Framing, 12. Implementation Notes, 13. What Forge Should Not Look Like, 14. Reference Alignment, 15. Design Checklist, 1. Design Direction, 2. App Shell (+33 more)

### Community 7 - "Developer Specialties & Squad Stats"
Cohesion: 0.12
Nodes (11): pillStyle(), SCORE_META, SpecialtyScore, SpecialtyTag, SpecialtyTagPills(), formatTrend(), SquadStatsPanel(), SquadStatsPanelProps (+3 more)

### Community 8 - "TypeScript Compiler Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 9 - "Electron App Build & Packaging Settings"
Cohesion: 0.12
Nodes (17): build, appId, directories, extraResources, files, icon, linux, mac (+9 more)

### Community 10 - "Developer Detail Modal Dialog"
Cohesion: 0.13
Nodes (11): activeTagButtonStyle, DeveloperDraft, DeveloperModal(), DeveloperModalProps, ghostButtonStyle, ghostDangerButtonStyle, iconButtonStyle, inputStyle (+3 more)

### Community 11 - "Project Dependencies & Tooling"
Cohesion: 0.15
Nodes (13): 16.10 Dense List Example, 16.11 Modal Example, 16.12 What Good Looks Like, 16.1 Global Shell, 16.2 Top Header Example, 16.3 Left Rail Example, 16.4 Right Rail Example, 16.5 Workspace Detail Example (+5 more)

### Community 12 - "Sanctum App Design & Layout System"
Cohesion: 0.31
Nodes (6): Sanctum App Shell Layout, Sanctum Color Palette, Local Database and Authentication Surface, Right Rail Drawer Interaction, Sanctum Typography System, Sanctum Visual System

### Community 13 - "Athena Context & LLM Prompting"
Cohesion: 0.39
Nodes (7): ATHENA_SYSTEM_DIRECTIVE, AthenaContextHit, buildAthenaPromptSections(), fetchAthenaCodeContext(), fetchAthenaMcpTools(), formatAthenaContextHits(), resolveAthenaPersona()

### Community 15 - "Module Definition & Navigation System"
Cohesion: 0.38
Nodes (4): appModule, SavantAppModule, SavantModuleAction, SavantModuleNavItem

### Community 16 - "Vite/Node TypeScript Configuration"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

### Community 17 - "Dev Startup & Electron Spawning"
Cohesion: 0.33
Nodes (3): http, { spawn }, startedAt

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (3): JiraTicketDB, JiraTicketDB — PostgreSQL backend., Return full Jira ticket records linked to a session (JOIN with jira_tickets).

### Community 23 - "Community 23"
Cohesion: 0.24
Nodes (19): AnyArray, appendAthenaThreadMessage(), AthenaContextKind, AthenaRunRecord, AthenaThread, AthenaThreadMessage, deleteAthenaThreadMessage(), dispatchChange() (+11 more)

## Knowledge Gaps
- **177 isolated node(s):** `name`, `version`, `description`, `author`, `main` (+172 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Forge Style Guide` connect `Athena AI Store & Memory Management` to `Project Dependencies & Tooling`, `Sanctum App Design & Layout System`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **What connects `JiraTicketDB — PostgreSQL backend.`, `Return full Jira ticket records linked to a session (JOIN with jira_tickets).`, `name` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Local State & Sprint Metrics Service` be split into smaller, more focused modules?**
  _Cohesion score 0.07071887784921099 - nodes in this community are weakly interconnected._
- **Should `Left Rail & Login Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06620209059233449 - nodes in this community are weakly interconnected._
- **Should `Electron Main Process` be split into smaller, more focused modules?**
  _Cohesion score 0.04440333024976873 - nodes in this community are weakly interconnected._
- **Should `Sprint Cockpit & Ticket Modals` be split into smaller, more focused modules?**
  _Cohesion score 0.06207482993197279 - nodes in this community are weakly interconnected._
- **Should `Sprint Workbench UI Panels` be split into smaller, more focused modules?**
  _Cohesion score 0.07977207977207977 - nodes in this community are weakly interconnected._