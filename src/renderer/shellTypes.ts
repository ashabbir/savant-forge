import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type SavantModuleAction = {
  label: string
  icon: LucideIcon
}

export type SavantModuleNavItem = {
  label: string
  icon: LucideIcon
}

export type SavantAppModule = {
  id: string
  subtitle: string
  eyebrow: string
  headline: string
  description: string
  navigation: SavantModuleNavItem[]
  actions: SavantModuleAction[]
  renderHome?: () => ReactNode
}
