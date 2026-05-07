import React, { useEffect, useState, useRef, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  FaBolt, FaUserPlus, FaPoll, FaTasks, FaCircle, FaPause, FaPlay,
} from 'react-icons/fa'
import { formatNumber } from './utils'
import { leadsService } from '../../services/leadsService'

const RealTimeTab = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [activityHistory, setActivityHistory] = useState([])
  const intervalRef = useRef(null)

  const tick = async () => {
    try {
      const d = await leadsService.fetchRealTime()
      setData(d)
      setActivityHistory((h) => [
        ...h.slice(-59),
        { ts: Date.now(), value: d.metrics?.activitiesLast15Min || 0 },
      ])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    tick()
    if (!paused) {
      intervalRef.current = setInterval(tick, 15000)
      return () => clearInterval(intervalRef.current)
    }
  }, [paused])

  const chartData = useMemo(() =>
    activityHistory.map(p => ({
      time: new Date(p.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      atividades: p.value,
    })), [activityHistory])

  const recent = data?.recentActivities || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className={`absolute inline-flex h-full w-full rounded-full ${paused ? 'bg-gray-400' : 'bg-emerald-400 animate-ping'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${paused ? 'bg-gray-500' : 'bg-emerald-500'}`} />
          </span>
          <span className="text-sm font-bold">{paused ? 'PAUSADO' : 'AO VIVO'}</span>
          <span className="text-xs text-gray-400">
            atualiza a cada 15s · último tick: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('pt-BR') : '—'}
          </span>
        </div>
        <button
          onClick={() => setPaused(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a]"
        >
          {paused ? <FaPlay className="w-3 h-3" /> : <FaPause className="w-3 h-3" />}
          {paused ? 'Retomar' : 'Pausar'}
        </button>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox icon={FaUserPlus} label="Novos clientes hoje" value={formatNumber(data?.metrics?.newClientsToday || 0)} color="from-blue-500 to-cyan-500" />
        <KpiBox icon={FaBolt} label="Atividades 15min" value={formatNumber(data?.metrics?.activitiesLast15Min || 0)} color="from-amber-500 to-orange-500" pulse={!paused} />
        <KpiBox icon={FaPoll} label="Respostas hoje" value={formatNumber(data?.metrics?.surveyResponsesToday || 0)} color="from-pink-500 to-rose-500" />
        <KpiBox icon={FaTasks} label="Webhook jobs 15min" value={formatNumber(data?.metrics?.webhookJobsLast15Min || 0)} color="from-purple-500 to-fuchsia-500" />
      </section>

      {/* Mini timeline */}
      {chartData.length > 1 && (
        <section className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3">Atividades nos últimos {Math.min(chartData.length, 60) * 15}s</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="atividades" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 2 }} animationDuration={400} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Feed atividades */}
      <section>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <FaCircle className="w-2 h-2 text-emerald-500" />
          Atividades recentes (últimos 15min)
        </h3>
        <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm divide-y divide-gray-100 dark:divide-[#27272a] max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-400">Carregando...</div>
          ) : recent.length ? recent.map((a) => (
            <div key={a.id} className="p-3 flex items-start gap-3 animate-slide-up">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${TYPE_COLOR[a.type] || 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-xs">{a.clientName || a.clientEmail}</span>
                  <span className="text-[10px] text-gray-400">{a.createdAt ? relativeTime(a.createdAt) : '—'}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{a.clientEmail}</p>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                  {a.type || 'evento'}
                </span>
                {a.metadata && Object.keys(a.metadata).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-gray-400 cursor-pointer">metadata</summary>
                    <pre className="text-[10px] text-gray-500 mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(a.metadata, null, 2).slice(0, 400)}</pre>
                  </details>
                )}
              </div>
            </div>
          )) : (
            <div className="p-12 text-center text-xs text-gray-400">Nenhuma atividade nos últimos 15 minutos</div>
          )}
        </div>
      </section>
    </div>
  )
}

function relativeTime(iso) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s atrás`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  return `${h}h atrás`
}

const TYPE_COLOR = {
  page_view: 'bg-blue-500',
  click: 'bg-purple-500',
  submit: 'bg-emerald-500',
  purchase: 'bg-amber-500',
  email_open: 'bg-pink-500',
}

const KpiBox = ({ icon: Icon, label, value, color, pulse }) => (
  <div className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-4 shadow-sm relative overflow-hidden">
    {pulse && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 animate-pulse" />}
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${color} flex items-center justify-center`}><Icon className="text-white w-3.5 h-3.5" /></div>
      <span className="text-[10px] text-gray-500 uppercase font-semibold">{label}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
  </div>
)

export default RealTimeTab
