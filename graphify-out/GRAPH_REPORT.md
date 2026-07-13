# Graph Report - .  (2026-07-12)

## Corpus Check
- 26 files · ~55,680 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 519 nodes · 892 edges · 35 communities (28 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Squad State & Metrics|Squad State & Metrics]]
- [[_COMMUNITY_App Screens & Modals|App Screens & Modals]]
- [[_COMMUNITY_Product Manager Workspace|Product Manager Workspace]]
- [[_COMMUNITY_Node Package Configuration|Node Package Configuration]]
- [[_COMMUNITY_Local SQLite DB & IPC|Local SQLite DB & IPC]]
- [[_COMMUNITY_Sprint Workbench Component|Sprint Workbench Component]]
- [[_COMMUNITY_Jira SQLite Integration|Jira SQLite Integration]]
- [[_COMMUNITY_App Settings & Client|App Settings & Client]]
- [[_COMMUNITY_Athena Store Context|Athena Store Context]]
- [[_COMMUNITY_Specialties & Stats UI|Specialties & Stats UI]]
- [[_COMMUNITY_TypeScript Compiler Options|TypeScript Compiler Options]]
- [[_COMMUNITY_Electron Builder Configuration|Electron Builder Configuration]]
- [[_COMMUNITY_Developer Dialog Styling|Developer Dialog Styling]]
- [[_COMMUNITY_UI Layout Examples|UI Layout Examples]]
- [[_COMMUNITY_Athena Copilot Service|Athena Copilot Service]]
- [[_COMMUNITY_Design Framing & Notes|Design Framing & Notes]]
- [[_COMMUNITY_App Core & Style Guide|App Core & Style Guide]]
- [[_COMMUNITY_Local Storage Test Mocks|Local Storage Test Mocks]]
- [[_COMMUNITY_Savant App Shell Modules|Savant App Shell Modules]]
- [[_COMMUNITY_Layout Model Spec|Layout Model Spec]]
- [[_COMMUNITY_TypeScript Node Config|TypeScript Node Config]]
- [[_COMMUNITY_Electron Dev Launcher|Electron Dev Launcher]]
- [[_COMMUNITY_Component Pattern Spec|Component Pattern Spec]]
- [[_COMMUNITY_Visual Style Spec|Visual Style Spec]]
- [[_COMMUNITY_Shell Layout Spec|Shell Layout Spec]]
- [[_COMMUNITY_State Feedback Spec|State Feedback Spec]]
- [[_COMMUNITY_Project Gemini Rules|Project Gemini Rules]]
- [[_COMMUNITY_Vite Environment Types|Vite Environment Types]]
- [[_COMMUNITY_Navigation Hierarchy Spec|Navigation Hierarchy Spec]]
- [[_COMMUNITY_AddTicketModal Tests|AddTicketModal Tests]]
- [[_COMMUNITY_LoginScreen Tests|LoginScreen Tests]]
- [[_COMMUNITY_SprintWorkbenchPanel Tests|SprintWorkbenchPanel Tests]]
- [[_COMMUNITY_Vite Build Setup|Vite Build Setup]]

## God Nodes (most connected - your core abstractions)
1. `JiraTicketDB` - 22 edges
2. `Forge Style Guide` - 18 edges
3. `compilerOptions` - 16 edges
4. `App()` - 13 edges
5. `16. Visual Examples` - 13 edges
6. `JiraTicket` - 12 edges
7. `scripts` - 10 edges
8. `build` - 10 edges
9. `Squad` - 10 edges
10. `getStoredApiKey()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Left Collapsible Panel Design Pattern` --rationale_for--> `SquadCockpit()`  [INFERRED]
  style-guide.md → src/renderer/components/SquadCockpit.tsx
- `Right Context Rail Detail Inspector Design Pattern` --rationale_for--> `SquadCockpit()`  [INFERRED]
  style-guide.md → src/renderer/components/SquadCockpit.tsx
- `SprintWorkbenchPanel()` --conceptually_related_to--> `JiraTicketDB`  [INFERRED]
  src/renderer/components/SprintWorkbenchPanel.tsx → jira_tickets_tmp.py
- `ProductManagerPanel()` --semantically_similar_to--> `SprintWorkbenchPanel()`  [INFERRED] [semantically similar]
  src/renderer/components/ProductManagerPanel.tsx → src/renderer/components/SprintWorkbenchPanel.tsx
- `System IPC Bridge` --conceptually_related_to--> `registerAthenaIpc()`  [INFERRED]
  src/main/electron/preload.ts → src/main/electron/main.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Athena Copilot Flow** — electron_athenadb_upsertathenathread, electron_main_registerathenaipc, electron_preload_system, renderer_app_buildathenacontextprofile [INFERRED 0.85]
- **Forge Modal Dialogs** — components_addticketmodal_addticketmodal, components_developermodal_developermodal, components_settingsmodal_settingsmodal [INFERRED 0.85]
- **Forge Main Views** — components_loginscreen_loginscreen, components_productmanagerpanel_productmanagerpanel, components_sprintworkbenchpanel_sprintworkbenchpanel [INFERRED 0.95]
- **Squad Cockpit UI components** — components_squadcockpit_squadcockpit, components_squadstatspanel_squadstatspanel, services_localstate_buildsquadsnapshot [INFERRED 0.85]

## Communities (35 total, 7 thin omitted)

### Community 0 - "Squad State & Metrics"
Cohesion: 0.08
Nodes (51): buildSquadSnapshot(), CompanyHoliday, computeCarryoverPoints(), computeDeveloperAvailability(), computeVelocity(), countEventDays(), createTicketLocal(), DEFAULT_WORKING_DAYS (+43 more)

### Community 1 - "App Screens & Modals"
Cohesion: 0.06
Nodes (29): Athena Context Awareness, AddTicketModal(), DeveloperModal(), describeSpecialties(), normalizeSpecialtyTags(), LeftRail(), LeftRailProps, LoginScreen() (+21 more)

### Community 2 - "Product Manager Workspace"
Cohesion: 0.06
Nodes (36): AddTicketModalProps, healthColors, PMDrawerMode, PMPanelProps, PMSelection, calculateWorkingDaysBetween(), fieldLabelStyle, getEndDateFromWorkingDays() (+28 more)

### Community 3 - "Node Package Configuration"
Cohesion: 0.05
Nodes (42): author, dependencies, better-sqlite3, lucide-react, react, react-dom, description, devDependencies (+34 more)

### Community 4 - "Local SQLite DB & IPC"
Cohesion: 0.13
Nodes (25): AthenaContextKind, AthenaRunRecord, AthenaThread, AthenaThreadMessage, db, loadAthenaRuns(), loadAthenaThreads(), normalizeRun() (+17 more)

### Community 5 - "Sprint Workbench Component"
Cohesion: 0.08
Nodes (16): badgeStyle, bandHeaderStyle, eventRowStyle, inputStyle, metricStyle, monoLabelStyle, plusDays(), primaryButtonStyle (+8 more)

### Community 6 - "Jira SQLite Integration"
Cohesion: 0.13
Nodes (3): JiraTicketDB, JiraTicketDB — PostgreSQL backend., Return full Jira ticket records linked to a session (JOIN with jira_tickets).

### Community 7 - "App Settings & Client"
Cohesion: 0.19
Nodes (19): SettingsModal(), SettingsModalProps, ForgeConfig, appendAuthHeader(), checkGatewayHealth(), checkServerHealth(), ConnectionStatus, fetchJson() (+11 more)

### Community 8 - "Athena Store Context"
Cohesion: 0.23
Nodes (21): Window System API Extension, AnyArray, appendAthenaThreadMessage(), AthenaContextKind, AthenaRunRecord, AthenaThread, AthenaThreadMessage, deleteAthenaThreadMessage() (+13 more)

### Community 9 - "Specialties & Stats UI"
Cohesion: 0.12
Nodes (11): pillStyle(), SCORE_META, SpecialtyScore, SpecialtyTag, SpecialtyTagPills(), formatTrend(), SquadStatsPanel(), SquadStatsPanelProps (+3 more)

### Community 10 - "TypeScript Compiler Options"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 11 - "Electron Builder Configuration"
Cohesion: 0.12
Nodes (17): build, appId, directories, extraResources, files, icon, linux, mac (+9 more)

### Community 12 - "Developer Dialog Styling"
Cohesion: 0.14
Nodes (10): activeTagButtonStyle, DeveloperDraft, DeveloperModalProps, ghostButtonStyle, ghostDangerButtonStyle, iconButtonStyle, inputStyle, SCORE_OPTIONS (+2 more)

### Community 13 - "UI Layout Examples"
Cohesion: 0.15
Nodes (13): 16.10 Dense List Example, 16.11 Modal Example, 16.12 What Good Looks Like, 16.1 Global Shell, 16.2 Top Header Example, 16.3 Left Rail Example, 16.4 Right Rail Example, 16.5 Workspace Detail Example (+5 more)

### Community 14 - "Athena Copilot Service"
Cohesion: 0.36
Nodes (10): ATHENA_SYSTEM_DIRECTIVE, AthenaContextHit, AthenaTool, buildAthenaPromptSections(), fetchAthenaCodeContext(), fetchAthenaMcpTools(), formatAthenaContextHits(), getAthenaSystem() (+2 more)

### Community 15 - "Design Framing & Notes"
Cohesion: 0.18
Nodes (11): 10. Motion, 11. Forge-Specific Product Framing, 12. Implementation Notes, 13. What Forge Should Not Look Like, 14. Reference Alignment, 15. Design Checklist, 1. Design Direction, 2. App Shell (+3 more)

### Community 16 - "App Core & Style Guide"
Cohesion: 0.29
Nodes (7): Sanctum App Shell Layout, Sanctum Color Palette, Local Database and Authentication Surface, Right Rail Drawer Interaction, Forge Style Guide Document, Sanctum Typography System, Sanctum Visual System

### Community 18 - "Savant App Shell Modules"
Cohesion: 0.38
Nodes (4): appModule, SavantAppModule, SavantModuleAction, SavantModuleNavItem

### Community 19 - "Layout Model Spec"
Cohesion: 0.29
Nodes (7): 3.1 Top Header, 3.2.1 Left Collapsible Panel, 3.2 Left Navigation Rail, 3.3 Center Workspace, 3.4 Right Context Rail, 3.5 Bottom Status Bar, 3. Layout Model

### Community 20 - "TypeScript Node Config"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

### Community 21 - "Electron Dev Launcher"
Cohesion: 0.33
Nodes (3): http, { spawn }, startedAt

### Community 22 - "Component Pattern Spec"
Cohesion: 0.33
Nodes (6): 6.1 Cards, 6.2 Tables and Lists, 6.3 Tabs and Subtabs, 6.4 Modals, 6.5 Toasts, 6. Component Patterns

### Community 23 - "Visual Style Spec"
Cohesion: 0.40
Nodes (5): 4.1 Overall Tone, 4.2 Typography, 4.3 Color, 4.4 Surfaces, 4. Visual Language

### Community 24 - "Shell Layout Spec"
Cohesion: 0.40
Nodes (5): 7.1 Header, 7.2 Left Bar, 7.3 Right Bar, 7.4 Bottom Bar, 7. Shell-Specific Guidance

### Community 25 - "State Feedback Spec"
Cohesion: 0.50
Nodes (4): 9.1 Loading, 9.2 Empty States, 9.3 Error States, 9. State and Feedback

### Community 28 - "Navigation Hierarchy Spec"
Cohesion: 0.67
Nodes (3): 5.1 Primary Hierarchy, 5.2 Secondary Hierarchy, 5. Navigation and Information Hierarchy

## Knowledge Gaps
- **196 isolated node(s):** `name`, `version`, `description`, `author`, `main` (+191 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Forge Style Guide` connect `Design Framing & Notes` to `UI Layout Examples`, `App Core & Style Guide`, `Layout Model Spec`, `Component Pattern Spec`, `Visual Style Spec`, `Shell Layout Spec`, `State Feedback Spec`, `Navigation Hierarchy Spec`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `SprintWorkbenchPanel()` connect `Sprint Workbench Component` to `App Screens & Modals`, `Product Manager Workspace`, `Jira SQLite Integration`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `JiraTicketDB` connect `Jira SQLite Integration` to `Sprint Workbench Component`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **What connects `JiraTicketDB — PostgreSQL backend.`, `Return full Jira ticket records linked to a session (JOIN with jira_tickets).`, `name` to the rest of the system?**
  _205 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Squad State & Metrics` be split into smaller, more focused modules?**
  _Cohesion score 0.07581453634085213 - nodes in this community are weakly interconnected._
- **Should `App Screens & Modals` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._
- **Should `Product Manager Workspace` be split into smaller, more focused modules?**
  _Cohesion score 0.05731523378582202 - nodes in this community are weakly interconnected._