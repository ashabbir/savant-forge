import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SprintWorkbenchPanel } from '../components/SprintWorkbenchPanel'
import { Squad, JiraTicket, SprintPlan } from '../services/localState'

describe('SprintWorkbenchPanel', () => {
  const mockSquad: Squad = {
    id: 'squad-alpha',
    name: 'Squad Alpha',
    developers: [
      { id: 'dev-1', name: 'Dev One', specialty: 'Backend', ranking: 'Senior', raw_capacity: 10 }
    ]
  }

  const mockLatestSnapshot = {
    id: 'snap-1',
    squad_id: 'squad-alpha',
    captured_at: new Date().toISOString(),
    total_effective_capacity: 8,
    assigned_points: 5,
    delivered_points: 5,
    open_points: 0,
    carryover_points: 0,
    load_ratio: 0.625,
    status: 'healthy' as const,
    developers: [
      { developer_id: 'dev-1', developer_name: 'Dev One', utilization: 0.625, workload_label: 'NORMAL' as const }
    ]
  }

  const mockSprintPlans: SprintPlan[] = [
    {
      id: 'sprint-1',
      squad_id: 'squad-alpha',
      name: 'Sprint 1',
      status: 'current',
      start_date: '2026-06-01',
      end_date: '2026-06-14',
      goals: [{ id: 'g-1', title: 'Goal 1', status: 'done' }]
    },
    {
      id: 'sprint-2',
      squad_id: 'squad-alpha',
      name: 'Sprint 2',
      status: 'future',
      start_date: '2026-06-15',
      end_date: '2026-06-28',
      goals: []
    }
  ]

  const mockTickets: JiraTicket[] = [
    {
      ticket_id: 't-1',
      workspace_id: 'w-1',
      ticket_key: 'J-1',
      title: 'Task One',
      status: 'todo',
      priority: 'medium',
      assignee: 'dev-1',
      reporter: 'user',
      story_points: 5,
      sprint_id: 'sprint-1'
    },
    {
      ticket_id: 't-2',
      workspace_id: 'w-1',
      ticket_key: 'J-2',
      title: 'Task Two',
      status: 'todo',
      priority: 'medium',
      assignee: '',
      reporter: 'user',
      story_points: 3,
      sprint_id: undefined
    }
  ]

  it('renders current mode with sprint details, attached tickets, and dropdown to attach backlog tickets', () => {
    const onUpdateTicket = vi.fn()
    const onCompleteSprint = vi.fn()

    render(
      <SprintWorkbenchPanel
        mode="current"
        activeSquad={mockSquad}
        history={[]}
        latest={mockLatestSnapshot}
        sprintPlans={mockSprintPlans}
        currentSprint={mockSprintPlans[0]}
        availabilityEvents={[]}
        tickets={mockTickets}
        onCreateSprint={() => {}}
        onSetCurrentSprint={() => {}}
        onCompleteSprint={onCompleteSprint}
        onAddAvailabilityEvent={() => {}}
        onUpdateTicket={onUpdateTicket}
      />
    )

    // Verify current sprint details render
    expect(screen.getAllByText('Sprint 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Goal 1')).toBeTruthy()

    // Verify attached ticket renders
    expect(screen.getByText('J-1')).toBeTruthy()
    expect(screen.getByText('Task One')).toBeTruthy()

    // Verify remove button functionality
    const removeBtn = screen.getByTitle('Remove from Sprint')
    expect(removeBtn).toBeTruthy()
    fireEvent.click(removeBtn)
    expect(onUpdateTicket).toHaveBeenCalledWith('t-1', { sprint_id: undefined })

    // Verify assignee select dropdown
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    const assigneeSelect = selects.find(sel => Array.from(sel.options).some(opt => opt.text.includes('Unassigned') && opt.value === ''))!
    expect(assigneeSelect).toBeDefined()
    fireEvent.change(assigneeSelect, { target: { value: 'dev-1' } })
    expect(onUpdateTicket).toHaveBeenCalledWith('t-1', { assignee: 'dev-1' })

    // Verify attach ticket dropdown
    const attachSelect = selects.find(sel => Array.from(sel.options).some(opt => opt.text.includes('+ ATTACH TICKET')))!
    expect(attachSelect).toBeDefined()
    // There should be the option to attach J-2 (Task Two)
    expect(screen.getByText('J-2 - Task Two...')).toBeTruthy()

    // Select the backlog ticket to attach
    fireEvent.change(attachSelect, { target: { value: 't-2' } })
    expect(onUpdateTicket).toHaveBeenCalledWith('t-2', { sprint_id: 'sprint-1' })

    // Verify complete sprint action
    const completeBtn = screen.getByText('Mark complete')
    fireEvent.click(completeBtn)
    expect(onCompleteSprint).toHaveBeenCalledWith('sprint-1')
  })

  it('renders future planning mode, displays upcoming sprints, and allows attaching and removing tickets', () => {
    const onUpdateTicket = vi.fn()
    const onSetCurrentSprint = vi.fn()
    const onCreateSprint = vi.fn()

    render(
      <SprintWorkbenchPanel
        mode="future"
        activeSquad={mockSquad}
        history={[]}
        latest={mockLatestSnapshot}
        sprintPlans={mockSprintPlans}
        currentSprint={mockSprintPlans[0]}
        availabilityEvents={[]}
        tickets={mockTickets}
        onCreateSprint={onCreateSprint}
        onSetCurrentSprint={onSetCurrentSprint}
        onCompleteSprint={() => {}}
        onAddAvailabilityEvent={() => {}}
        onUpdateTicket={onUpdateTicket}
      />
    )

    // Verify upcoming sprint renders
    expect(screen.getByText('Sprint 2')).toBeTruthy()
    expect(screen.getByText('Set current')).toBeTruthy()

    // Clicking "Set current" should call onSetCurrentSprint
    fireEvent.click(screen.getByText('Set current'))
    expect(onSetCurrentSprint).toHaveBeenCalledWith('sprint-2')

    // Find the attach select dropdown for the upcoming sprint
    // Since there are multiple select elements, let's target by searching options
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    // The first dropdown might be other selects, or let's find the one containing ticket options
    const attachSelect = selects.find(sel => {
      return Array.from(sel.options).some(opt => opt.text.includes('+ ATTACH TICKET'))
    })
    expect(attachSelect).toBeDefined()

    // Change to attach t-2 to Sprint 2
    fireEvent.change(attachSelect!, { target: { value: 't-2' } })
    expect(onUpdateTicket).toHaveBeenCalledWith('t-2', { sprint_id: 'sprint-2' })

    // Form inputs check: Sprint Name
    const sprintNameInput = screen.getByLabelText('Sprint name') as HTMLInputElement
    fireEvent.change(sprintNameInput, { target: { value: 'Sprint 3' } })

    const createBtn = screen.getByText('Create sprint')
    fireEvent.click(createBtn)
    expect(onCreateSprint).toHaveBeenCalledWith({
      name: 'Sprint 3',
      start_date: expect.any(String),
      end_date: expect.any(String),
      goal: 'Deliver planned scope'
    })
  })

  it('renders past mode with historical metrics and developer utilization', () => {
    render(
      <SprintWorkbenchPanel
        mode="past"
        activeSquad={mockSquad}
        history={[mockLatestSnapshot]}
        latest={mockLatestSnapshot}
        sprintPlans={mockSprintPlans}
        currentSprint={mockSprintPlans[0]}
        availabilityEvents={[]}
        tickets={mockTickets}
        onCreateSprint={() => {}}
        onSetCurrentSprint={() => {}}
        onCompleteSprint={() => {}}
        onAddAvailabilityEvent={() => {}}
        onUpdateTicket={() => {}}
      />
    )

    expect(screen.getAllByText('Total Delivered').length).toBeGreaterThan(0)
    expect(screen.getByText('Dev One')).toBeTruthy()
    expect(screen.getAllByText('63%').length).toBeGreaterThan(0)
  })
})
