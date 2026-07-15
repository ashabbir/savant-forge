import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SquadCockpit } from '../components/SquadCockpit'
import { Squad, Developer, JiraTicket } from '../services/localState'

describe('SquadCockpit', () => {
  const mockSquad: Squad = {
    id: 'squad-alpha',
    name: 'Squad Alpha',
    developers: [
      { id: 'dev-1', name: 'Dev One', specialty: 'Backend', ranking: 'Senior', raw_capacity: 10 }
    ]
  }

  const mockStats = {
    totalRaw: 10,
    totalEffective: 8,
    assigned: 5,
    isOverload: false
  }

  const mockDevLoad = [
    {
      dev: mockSquad.developers[0],
      assignedTickets: [
        { ticket_id: 't-1', workspace_id: 'w-1', ticket_key: 'J-1', title: '[SP-5] Task One', status: 'todo', priority: 'medium', assignee: 'dev-1', reporter: 'user', story_points: 5 }
      ],
      totalPoints: 5,
      effectiveCapacity: 8,
      ratio: 0.625,
      isOverload: false,
      statusColor: 'cyan'
    }
  ]

  it('renders squad info and developer loading metrics', () => {
    render(
      <SquadCockpit 
        activeSquad={mockSquad}
        squadCapacityStats={mockStats}
        devLoadStats={mockDevLoad}
        selectedDeveloperId={null}
        setSelectedDeveloperId={() => {}}
        setSelectedTicketId={() => {}}
        setSelectedPrdId={() => {}}
        setRightPanelTab={() => {}}
        setRightPanelOpen={() => {}}
        assignTicketToDeveloper={() => {}}
      />
    )

    expect(screen.getByText('Squad Alpha')).toBeTruthy()
    expect(screen.getByText('Dev One')).toBeTruthy()
    expect(screen.getByText('SENIOR')).toBeTruthy()
    expect(screen.getByText('HAPPY')).toBeTruthy()
    expect(screen.getByText('Load: 5 SP')).toBeTruthy()
    expect(screen.getByText('Task One')).toBeTruthy()
  })

  it('renders overload indicator when workload exceeds capacity safety buffer limit', () => {
    const overloadedStats = { ...mockStats, isOverload: true, assigned: 12 }
    const overloadedDev = [
      {
        ...mockDevLoad[0],
        totalPoints: 12,
        isOverload: true,
        statusColor: 'destructive'
      }
    ]

    render(
      <SquadCockpit 
        activeSquad={mockSquad}
        squadCapacityStats={overloadedStats}
        devLoadStats={overloadedDev}
        selectedDeveloperId={null}
        setSelectedDeveloperId={() => {}}
        setSelectedTicketId={() => {}}
        setSelectedPrdId={() => {}}
        setRightPanelTab={() => {}}
        setRightPanelOpen={() => {}}
        assignTicketToDeveloper={() => {}}
      />
    )

    const devSlot = screen.getByTestId('dev-slot-dev-1')
    expect(devSlot.className).toContain('glowing-alert-red')
    expect(screen.getByText('OVERWORKED')).toBeTruthy()
  })

  it('triggers callbacks when a developer slot is clicked', () => {
    const setSelectedDeveloperId = vi.fn()
    const setRightPanelTab = vi.fn()
    const setRightPanelOpen = vi.fn()

    render(
      <SquadCockpit 
        activeSquad={mockSquad}
        squadCapacityStats={mockStats}
        devLoadStats={mockDevLoad}
        selectedDeveloperId={null}
        setSelectedDeveloperId={setSelectedDeveloperId}
        setSelectedTicketId={vi.fn()}
        setSelectedPrdId={vi.fn()}
        setRightPanelTab={setRightPanelTab}
        setRightPanelOpen={setRightPanelOpen}
        assignTicketToDeveloper={() => {}}
      />
    )

    fireEvent.click(screen.getByTestId('dev-slot-dev-1'))

    expect(setSelectedDeveloperId).toHaveBeenCalledWith('dev-1')
    expect(setRightPanelTab).toHaveBeenCalledWith('dev-inspector')
    expect(setRightPanelOpen).toHaveBeenCalledWith(true)
  })

  it('handles dragstart on assigned tickets', () => {
    render(
      <SquadCockpit 
        activeSquad={mockSquad}
        squadCapacityStats={mockStats}
        devLoadStats={mockDevLoad}
        selectedDeveloperId={null}
        setSelectedDeveloperId={() => {}}
        setSelectedTicketId={() => {}}
        setSelectedPrdId={() => {}}
        setRightPanelTab={() => {}}
        setRightPanelOpen={() => {}}
        assignTicketToDeveloper={() => {}}
      />
    )

    const ticketElement = screen.getByTestId('assigned-ticket-t-1')
    const dataTransfer = {
      setData: vi.fn()
    }
    
    fireEvent.dragStart(ticketElement, { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 't-1')
  })

  it('handles drop events to assign ticket to developer', () => {
    const assignTicket = vi.fn()
    render(
      <SquadCockpit 
        activeSquad={mockSquad}
        squadCapacityStats={mockStats}
        devLoadStats={mockDevLoad}
        selectedDeveloperId={null}
        setSelectedDeveloperId={() => {}}
        setSelectedTicketId={() => {}}
        setSelectedPrdId={() => {}}
        setRightPanelTab={() => {}}
        setRightPanelOpen={() => {}}
        assignTicketToDeveloper={assignTicket}
      />
    )

    const devSlot = screen.getByTestId('dev-slot-dev-1')
    const dataTransfer = {
      getData: () => 't-unassigned'
    }

    fireEvent.drop(devSlot, { dataTransfer })
    expect(assignTicket).toHaveBeenCalledWith('t-unassigned', 'dev-1')
  })

  it('renders fallback when developer has no assigned tickets', () => {
    const devLoadEmpty = [
      {
        ...mockDevLoad[0],
        assignedTickets: [],
        totalPoints: 0
      }
    ]

    render(
      <SquadCockpit 
        activeSquad={mockSquad}
        squadCapacityStats={mockStats}
        devLoadStats={devLoadEmpty}
        selectedDeveloperId={null}
        setSelectedDeveloperId={() => {}}
        setSelectedTicketId={() => {}}
        setSelectedPrdId={() => {}}
        setRightPanelTab={() => {}}
        setRightPanelOpen={() => {}}
        assignTicketToDeveloper={() => {}}
      />
    )

    expect(screen.getByText('Drop tickets here')).toBeTruthy()
  })

  it('renders linked PRDs belonging to the active squad', () => {
    const mockPrds = [
      { id: 'prd-1', title: 'Payment Integration PRD', content: 'Specs...', status: 'draft' as const, lastUpdated: new Date().toISOString(), squadId: 'squad-alpha' },
      { id: 'prd-2', title: 'Auth Service PRD', content: 'Specs...', status: 'ready' as const, lastUpdated: new Date().toISOString(), squadId: 'squad-beta' }
    ]
    const onSelectPrd = vi.fn()

    render(
      <SquadCockpit 
        activeSquad={mockSquad}
        squadCapacityStats={mockStats}
        devLoadStats={mockDevLoad}
        selectedDeveloperId={null}
        setSelectedDeveloperId={() => {}}
        setSelectedTicketId={() => {}}
        setSelectedPrdId={() => {}}
        setRightPanelTab={() => {}}
        setRightPanelOpen={() => {}}
        assignTicketToDeveloper={() => {}}
        prds={mockPrds}
        onSelectPrd={onSelectPrd}
      />
    )

    // Should display the PRD that belongs to squad-alpha
    expect(screen.getByText('Payment Integration PRD')).toBeTruthy()
    // Should NOT display the PRD that belongs to squad-beta
    expect(screen.queryByText('Auth Service PRD')).toBeNull()

    // Trigger select callback
    fireEvent.click(screen.getByText('Payment Integration PRD'))
    expect(onSelectPrd).toHaveBeenCalledWith('prd-1')
  })
})
