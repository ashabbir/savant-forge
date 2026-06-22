import { Users, Layers, Sliders, Play } from 'lucide-react'
import type { SavantAppModule } from './shellTypes'

export const appModule: SavantAppModule = {
  id: 'forge',
  subtitle: 'Resource & Capability Engine',
  eyebrow: 'Savant Forge Pool',
  headline: 'Savant Forge Cockpit',
  description:
    'Savant Forge is an operational workspace and resource-matching hub enabling Product Managers (PMs) to break down projects, write/interact with Jira tickets directly, and dynamically map engineering resources against sprint workloads under a strict 20% capability safety buffer.',
  navigation: [
    { label: 'Squads Dashboard', icon: Users },
    { label: 'Jira Blueprint lists', icon: Layers },
    { label: 'Forge Settings', icon: Sliders }
  ],
  actions: [
    { label: 'Live metrics', icon: Play }
  ]
}
