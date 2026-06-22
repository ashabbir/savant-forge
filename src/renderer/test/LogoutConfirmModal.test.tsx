import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LogoutConfirmModal } from '../components/LogoutConfirmModal'

describe('LogoutConfirmModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <LogoutConfirmModal 
        isOpen={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders confirmation text and buttons when open', () => {
    render(
      <LogoutConfirmModal 
        isOpen={true}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    expect(screen.getByText('TERMINATE SESSION?')).toBeTruthy()
    expect(screen.getByText('Are you sure you want to log out of Savant Forge? This will clear active registries.')).toBeTruthy()
    expect(screen.getByText('LOG OUT')).toBeTruthy()
    expect(screen.getByText('CANCEL')).toBeTruthy()
  })

  it('calls onConfirm when Log Out is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <LogoutConfirmModal 
        isOpen={true}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )

    fireEvent.click(screen.getByText('LOG OUT'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(
      <LogoutConfirmModal 
        isOpen={true}
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByText('CANCEL'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when backdrop is clicked', () => {
    const onCancel = vi.fn()
    render(
      <LogoutConfirmModal 
        isOpen={true}
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByTestId('logout-backdrop'))
    expect(onCancel).toHaveBeenCalled()
  })
})
