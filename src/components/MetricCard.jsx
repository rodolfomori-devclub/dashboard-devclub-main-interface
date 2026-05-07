import React, { useState } from 'react'
import { FaBullseye, FaPen, FaArrowUp, FaArrowDown } from 'react-icons/fa'

const NEUTRAL_COLORS = {
  gradientFrom: '#7B93B0',
  gradientTo: '#9CB4CF',
  iconGradientFrom: '#7B93B0',
  iconGradientTo: '#5E7A99',
}

function getGoalColors(value, goal, isInverse = false) {
  if (!goal || goal <= 0 || !value || value <= 0) return NEUTRAL_COLORS
  const ratio = isInverse ? goal / value : value / goal
  if (ratio >= 1.1) return { gradientFrom: '#2563EB', gradientTo: '#3B82F6', iconGradientFrom: '#2563EB', iconGradientTo: '#1D4ED8' }
  if (ratio >= 1.0) return { gradientFrom: '#3B82F6', gradientTo: '#60A5FA', iconGradientFrom: '#3B82F6', iconGradientTo: '#2563EB' }
  if (ratio >= 0.85) return { gradientFrom: '#EAB308', gradientTo: '#FACC15', iconGradientFrom: '#EAB308', iconGradientTo: '#CA8A04' }
  return { gradientFrom: '#EF4444', gradientTo: '#F87171', iconGradientFrom: '#EF4444', iconGradientTo: '#DC2626' }
}

const MetricCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  gradientFrom,
  gradientTo,
  iconGradientFrom,
  iconGradientTo,
  delay = '0s',
  goalKey,
  goalValue,
  onGoalChange,
  isInverse,
  rawValue,
  goalPrefix,
  goalSuffix,
  delta,
  deltaLabel,
  deltaInverse,
  badge,
  onClick,
}) => {
  const [editing, setEditing] = useState(false)
  const [tempGoal, setTempGoal] = useState('')

  const hasGoal = goalKey !== undefined
  const colors = hasGoal && goalValue > 0
    ? getGoalColors(rawValue, goalValue, isInverse)
    : hasGoal
      ? NEUTRAL_COLORS
      : { gradientFrom: gradientFrom || NEUTRAL_COLORS.gradientFrom, gradientTo: gradientTo || NEUTRAL_COLORS.gradientTo, iconGradientFrom: iconGradientFrom || NEUTRAL_COLORS.iconGradientFrom, iconGradientTo: iconGradientTo || NEUTRAL_COLORS.iconGradientTo }

  const handleGoalSubmit = () => {
    const parsed = parseFloat(String(tempGoal).replace(',', '.'))
    if (!isNaN(parsed) && parsed > 0 && onGoalChange) {
      onGoalChange(goalKey, parsed)
    }
    setEditing(false)
    setTempGoal('')
  }

  // Delta: positivo é "bom" por padrão; se deltaInverse=true (CPM, CPL), positivo é "ruim"
  const deltaNum = typeof delta === 'number' && !isNaN(delta) ? delta : null
  const deltaPositive = deltaNum !== null ? deltaNum > 0 : false
  const deltaGood = deltaNum !== null ? (deltaInverse ? deltaNum < 0 : deltaNum > 0) : null

  return (
    <div
      className={`group relative animate-slide-up ${onClick ? 'cursor-pointer' : ''}`}
      style={{ animationDelay: delay }}
      onClick={onClick}
    >
      <div
        className="absolute inset-0 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300 opacity-60"
        style={{ background: `linear-gradient(135deg, ${colors.gradientFrom}33, ${colors.gradientTo}33)` }}
      />
      <div
        className="relative backdrop-blur-lg rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
        style={{
          background: hasGoal && goalValue > 0
            ? `linear-gradient(135deg, ${colors.gradientFrom}20, ${colors.gradientTo}30)`
            : 'rgba(255,255,255,0.8)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          {Icon && (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${colors.iconGradientFrom}, ${colors.iconGradientTo})` }}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
          )}
          {badge && (
            <span className="px-2 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {badge}
            </span>
          )}
          {!badge && (
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colors.iconGradientFrom }} />
          )}
        </div>

        <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark mb-2">
          {title}
        </h3>

        <p
          className="text-3xl font-bold bg-clip-text text-transparent mb-1"
          style={{ backgroundImage: `linear-gradient(135deg, ${colors.iconGradientFrom}, ${colors.iconGradientTo})` }}
        >
          {value}
        </p>

        {subtitle && (
          <p className="text-xs text-text-muted-light dark:text-text-muted-dark flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.iconGradientFrom }} />
            {subtitle}
          </p>
        )}

        {deltaNum !== null && (
          <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${
            deltaGood ? 'text-emerald-600 dark:text-emerald-400' : deltaGood === false ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500'
          }`}>
            {deltaPositive ? <FaArrowUp className="w-2.5 h-2.5" /> : <FaArrowDown className="w-2.5 h-2.5" />}
            {Math.abs(deltaNum).toFixed(1)}%
            {deltaLabel && <span className="text-gray-400 font-normal ml-1">{deltaLabel}</span>}
          </div>
        )}

        {hasGoal && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
            {editing ? (
              <div className="flex items-center gap-1.5">
                {goalPrefix && <span className="text-xs text-text-muted-light dark:text-text-muted-dark">{goalPrefix}</span>}
                <input
                  type="text"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGoalSubmit()
                    if (e.key === 'Escape') { setEditing(false); setTempGoal('') }
                  }}
                  onBlur={handleGoalSubmit}
                  autoFocus
                  placeholder="0"
                  className="w-20 px-2 py-1 text-xs rounded-lg border border-primary/30 bg-white/80 dark:bg-gray-800/80 text-text-light dark:text-text-dark outline-none focus:ring-2 focus:ring-primary/20"
                />
                {goalSuffix && <span className="text-xs text-text-muted-light dark:text-text-muted-dark">{goalSuffix}</span>}
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); setTempGoal(goalValue > 0 ? String(goalValue) : '') }}
                className="flex items-center gap-1.5 text-xs text-text-muted-light dark:text-text-muted-dark hover:text-primary transition-colors"
              >
                <FaBullseye className="w-3 h-3" />
                {goalValue > 0
                  ? `Meta: ${goalPrefix || ''}${goalValue}${goalSuffix || ''}`
                  : 'Definir meta'}
                <FaPen className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MetricCard
