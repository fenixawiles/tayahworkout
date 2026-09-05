interface ProgressCardProps {
  monthLabel: string
  completed: number
  total: number
}

export function ProgressCard({ monthLabel, completed, total }: ProgressCardProps) {
  const percent = total ? Math.round((completed / total) * 100) : 0
  return (
    <section className="progress-card" aria-labelledby="month-progress-title">
      <div className="progress-copy">
        <div>
          <p className="eyebrow">{monthLabel.toUpperCase()}</p>
          <h2 id="month-progress-title">{total ? completed === total ? 'You made it happen.' : 'Every rep adds up.' : 'Plan your first workout'}</h2>
        </div>
        {total > 0 && <strong>{completed} <span>of {total}</span></strong>}
      </div>
      {total > 0 && (
        <>
          <div className="progress-track" role="progressbar" aria-label={`${completed} of ${total} exercises complete`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="progress-footnote"><span>Your month in motion</span><span>Exercises completed</span></div>
        </>
      )}
    </section>
  )
}
