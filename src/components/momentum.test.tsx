import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DayPlan } from '../types'
import { validateExerciseImage } from '../lib/exercise'
import { DayPanel } from './DayPanel'
import { ProgressCard } from './ProgressCard'

const workout: DayPlan = {
  id: 'plan-1',
  date: '2026-09-03',
  title: 'Full body reset',
  reflection: '',
  exercises: [{
    id: 'item-1',
    sourceExerciseId: 'goblet-squat',
    name: 'Goblet squat',
    category: 'strength',
    bodyArea: 'lower-body',
    imagePath: null,
    imageUrl: null,
    target: '3 × 10',
    notes: '',
    sortOrder: 0,
    completedAt: null,
  }],
}

describe('focused workout states', () => {
  it('shows the exact progress count or a planning invitation', () => {
    const { rerender } = render(<ProgressCard monthLabel="September" completed={30} total={90} />)
    expect(screen.getByText('30')).toHaveTextContent('30 of 90')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
    rerender(<ProgressCard monthLabel="September" completed={0} total={0} />)
    expect(screen.getByText('Plan your first workout')).toBeVisible()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('marks an edited plan dirty and keeps one emphasized save action', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(
      <DayPanel
        open
        date="2026-09-03"
        today="2026-09-03"
        plan={workout}
        exercises={[]}
        templates={[]}
        offline={false}
        startEditing
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onToggle={vi.fn().mockResolvedValue(undefined)}
        onSaveTemplate={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const title = screen.getByPlaceholderText('Full body reset')
    await user.clear(title)
    await user.type(title, 'Strong start')
    expect(screen.getByText('Unsaved changes')).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Save changes' })).toHaveLength(1)
  })

  it('rejects unsupported phone image formats before saving', () => {
    const file = new File(['gif'], 'exercise.gif', { type: 'image/gif' })
    expect(validateExerciseImage(file)).toContain('JPEG, PNG, or WebP')
  })
})
