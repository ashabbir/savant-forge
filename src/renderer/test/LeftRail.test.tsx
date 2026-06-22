import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LeftRail } from '../components/LeftRail'

describe('LeftRail', () => {
  it('renders all rail items and highlights the active tab', () => {
    render(
      <LeftRail 
        activeTab="blueprint"
        isLeftPaneOpen={true}
        isSettingsOpen={false}
        isLogoutConfirmOpen={false}
        onSelectTab={() => {}}
        onToggleLeftPane={() => {}}
        onOpenSettings={() => {}}
        onOpenLogoutConfirm={() => {}}
      />
    )

    expect(screen.getByTestId('tab-squad')).toBeTruthy()
    expect(screen.getByTestId('tab-projects')).toBeTruthy()
    expect(screen.getByTestId('tab-blueprint')).toBeTruthy()
    expect(screen.getByTestId('toggle-left-pane')).toBeTruthy()
    expect(screen.getByTestId('btn-settings')).toBeTruthy()
    expect(screen.getByTestId('btn-logout')).toBeTruthy()

    expect(screen.getByTestId('tab-blueprint').className).toContain('active')
    expect(screen.getByTestId('tab-squad').className).not.toContain('active')
  })

  it('triggers onSelectTab callback on tab clicks', () => {
    const onSelectTab = vi.fn()
    render(
      <LeftRail 
        activeTab="blueprint"
        isLeftPaneOpen={true}
        isSettingsOpen={false}
        isLogoutConfirmOpen={false}
        onSelectTab={onSelectTab}
        onToggleLeftPane={() => {}}
        onOpenSettings={() => {}}
        onOpenLogoutConfirm={() => {}}
      />
    )

    fireEvent.click(screen.getByTestId('tab-squad'))
    expect(onSelectTab).toHaveBeenCalledWith('squad')

    fireEvent.click(screen.getByTestId('tab-projects'))
    expect(onSelectTab).toHaveBeenCalledWith('projects')
  })

  it('triggers toggle, settings, and logout callback triggers', () => {
    const onToggleLeftPane = vi.fn()
    const onOpenSettings = vi.fn()
    const onOpenLogoutConfirm = vi.fn()

    render(
      <LeftRail 
        activeTab="blueprint"
        isLeftPaneOpen={true}
        isSettingsOpen={false}
        isLogoutConfirmOpen={false}
        onSelectTab={() => {}}
        onToggleLeftPane={onToggleLeftPane}
        onOpenSettings={onOpenSettings}
        onOpenLogoutConfirm={onOpenLogoutConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('toggle-left-pane'))
    expect(onToggleLeftPane).toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('btn-settings'))
    expect(onOpenSettings).toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('btn-logout'))
    expect(onOpenLogoutConfirm).toHaveBeenCalled()
  })
})
