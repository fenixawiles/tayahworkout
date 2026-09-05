import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { seedExercises } from '../data/seedExercises'
import { exerciseTarget, validateExerciseSettings } from '../lib/exercise'
import { ExerciseDetail } from './ExerciseDetail'

describe('personal exercise settings', () => {
  it('keeps changes available after a failed save and allows a retry', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(undefined)
    render(<ExerciseDetail exercise={seedExercises()[0]} offline={false} onClose={vi.fn()} onSave={save} />)
    await user.type(screen.getByLabelText('Weight optional'), '12.5')
    await user.click(screen.getByRole('button', { name: 'kg' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again')
    expect(screen.getByLabelText('Weight optional')).toHaveValue(12.5)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Saved')).toBeVisible()
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Goblet squat' }), { target: '3 × 10', weight: 12.5, weightUnit: 'kg' })
  })

  it('formats a snapshot without requiring reps or weights', () => {
    expect(exerciseTarget({ defaultTarget: '4 × 8', defaultWeight: 22.5, defaultWeightUnit: 'kg' })).toBe('4 × 8 · 22.5 kg')
    expect(exerciseTarget({ defaultTarget: '', defaultWeight: 15 })).toBe('15 lb')
    expect(exerciseTarget({ defaultTarget: '20 min' })).toBe('20 min')
    expect(exerciseTarget({ defaultTarget: '' })).toBe('')
    expect(validateExerciseSettings({ target: '', weight: null, weightUnit: 'lb' })).toBeNull()
    expect(validateExerciseSettings({ target: '', weight: Infinity, weightUnit: 'lb' })).not.toBeNull()
    expect(validateExerciseSettings({ target: 'x'.repeat(81), weight: null, weightUnit: 'lb' })).not.toBeNull()
  })
})
