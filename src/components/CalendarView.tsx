import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, isSameMonth, parseISO } from 'date-fns'
import type { DayPlan } from '../types'
import { dateKey, monthGrid, planState, shiftMonth } from '../lib/date'

interface CalendarViewProps {
  month: Date
  today: string
  plans: DayPlan[]
  onMonthChange: (month: Date) => void
  onSelectDate: (date: string) => void
}

const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function CalendarView({ month, today, plans, onMonthChange, onSelectDate }: CalendarViewProps) {
  const plansByDate = new Map(plans.map((plan) => [plan.date, plan]))
  const days = monthGrid(month)
  const monthPlans = plans.filter((plan) => plan.date.startsWith(format(month, 'yyyy-MM')) && plan.exercises.length).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <section className="view-section calendar-view" aria-labelledby="calendar-title">
      <div className="calendar-heading">
        <div>
          <p className="eyebrow">YOUR MONTH</p>
          <h1 id="calendar-title">{format(month, 'MMMM yyyy')}</h1>
        </div>
        <div className="month-controls">
          <button aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft /></button>
          <button aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight /></button>
        </div>
      </div>

      <div className="calendar-card">
        <div className="weekday-row" aria-hidden="true">
          {weekDays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="month-grid">
          {days.map((day) => {
            const key = dateKey(day)
            const plan = plansByDate.get(key)
            const state = planState(plan, today)
            return (
              <button
                key={key}
                type="button"
                className={`calendar-day ${!isSameMonth(day, month) ? 'outside' : ''} ${key === today ? 'is-today' : ''} state-${state}`}
                aria-label={`${format(day, 'EEEE, MMMM d')}${plan ? `, ${plan.title}, ${state}` : ', unplanned'}`}
                onClick={() => onSelectDate(key)}
              >
                <span className="day-number">{format(day, 'd')}</span>
                {plan && plan.exercises.length > 0 && <span className="day-marker" aria-hidden="true">{state === 'complete' && <Check />}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="calendar-key" aria-label="Calendar key">
        <span><i className="key-dot planned" /> Planned</span>
        <span><i className="key-dot complete" /> Complete</span>
        <span><i className="key-dot missed" /> Missed</span>
      </div>
      {monthPlans.length > 0 && <section className="calendar-agenda" aria-labelledby="agenda-title">
        <div className="section-heading"><h2 id="agenda-title">On your calendar</h2><span className="section-count">{monthPlans.length} days</span></div>
        <div className="agenda-list">{monthPlans.map((plan) => <button className="agenda-row" key={plan.id} onClick={() => onSelectDate(plan.date)}>
          <span className="agenda-date"><small>{format(parseISO(plan.date), 'EEE')}</small><b>{format(parseISO(plan.date), 'dd')}</b></span>
          <span className="exercise-copy"><strong>{plan.title}</strong><span>{plan.exercises.filter((item) => item.completedAt).length} of {plan.exercises.length} complete</span></span>
          <ChevronRight aria-hidden="true" />
        </button>)}</div>
      </section>}
    </section>
  )
}
