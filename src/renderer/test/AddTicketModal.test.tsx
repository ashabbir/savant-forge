import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddTicketModal } from '../components/AddTicketModal'

describe('AddTicketModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AddTicketModal 
        isOpen={false}
        onClose={() => {}}
        onCreate={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders inputs, selects, and buttons when open', () => {
    render(
      <AddTicketModal 
        isOpen={true}
        onClose={() => {}}
        onCreate={() => {}}
      />
    )

    expect(screen.getByText('CREATE JIRA TICKET')).toBeTruthy()
    expect(screen.getByLabelText('TICKET KEY')).toBeTruthy()
    expect(screen.getByLabelText('TICKET TITLE')).toBeTruthy()
    expect(screen.getByLabelText('STORY POINTS')).toBeTruthy()
    expect(screen.getByLabelText('PRIORITY')).toBeTruthy()
    expect(screen.getByText('CREATE TICKET')).toBeTruthy()
    expect(screen.getByText('CANCEL')).toBeTruthy()
  })

  it('calls onCreate with input values on form submission', () => {
    const onCreate = vi.fn()
    const onClose = vi.fn()
    
    render(
      <AddTicketModal 
        isOpen={true}
        onClose={onClose}
        onCreate={onCreate}
      />
    )

    const titleInput = screen.getByLabelText('TICKET TITLE') as HTMLInputElement
    const keyInput = screen.getByLabelText('TICKET KEY') as HTMLInputElement
    const pointsSelect = screen.getByLabelText('STORY POINTS') as HTMLSelectElement
    const prioritySelect = screen.getByLabelText('PRIORITY') as HTMLSelectElement

    fireEvent.change(titleInput, { target: { value: 'Implement payment modal' } })
    fireEvent.change(keyInput, { target: { value: 'TEST-120' } })
    fireEvent.change(pointsSelect, { target: { value: '8' } })
    fireEvent.change(prioritySelect, { target: { value: 'high' } })

    fireEvent.click(screen.getByText('CREATE TICKET'))

    expect(onCreate).toHaveBeenCalledWith({
      ticket_key: 'TEST-120',
      title: 'Implement payment modal',
      story_points: 8,
      priority: 'high'
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(
      <AddTicketModal 
        isOpen={true}
        onClose={onClose}
        onCreate={() => {}}
      />
    )

    fireEvent.click(screen.getByText('CANCEL'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <AddTicketModal 
        isOpen={true}
        onClose={onClose}
        onCreate={() => {}}
      />
    )

    fireEvent.click(screen.getByTestId('add-ticket-modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('pre-populates inputs and calls onUpdate on submit in edit mode', () => {
    const onUpdate = vi.fn()
    const onClose = vi.fn()
    const existingTicket = {
      ticket_id: 't-123',
      workspace_id: 'w-1',
      ticket_key: 'JIRA-999',
      title: '[SP-3] Existing Title',
      status: 'todo',
      priority: 'low',
      assignee: '',
      reporter: 'ahmed',
      story_points: 3
    }

    render(
      <AddTicketModal 
        isOpen={true}
        onClose={onClose}
        onCreate={() => {}}
        onUpdate={onUpdate}
        ticket={existingTicket}
      />
    )

    expect(screen.getByText('EDIT JIRA TICKET')).toBeTruthy()
    const titleInput = screen.getByLabelText('TICKET TITLE') as HTMLInputElement
    const keyInput = screen.getByLabelText('TICKET KEY') as HTMLInputElement
    const pointsSelect = screen.getByLabelText('STORY POINTS') as HTMLSelectElement
    const prioritySelect = screen.getByLabelText('PRIORITY') as HTMLSelectElement

    // Check pre-populated values
    expect(keyInput.value).toBe('JIRA-999')
    expect(titleInput.value).toBe('Existing Title')
    expect(pointsSelect.value).toBe('3')
    expect(prioritySelect.value).toBe('low')

    // Modify title and submit
    fireEvent.change(titleInput, { target: { value: 'Modified Title' } })
    fireEvent.click(screen.getByText('SAVE CHANGES'))

    expect(onUpdate).toHaveBeenCalledWith('t-123', {
      ticket_key: 'JIRA-999',
      title: 'Modified Title',
      story_points: 3,
      priority: 'low'
    })
    expect(onClose).toHaveBeenCalled()
  })
})
