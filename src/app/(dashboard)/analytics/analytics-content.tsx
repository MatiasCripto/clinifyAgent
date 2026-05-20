'use client'

import { useMemo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { StatCard } from '@/components/ui/stat-card'
import { NpsGauge } from '@/components/ui/nps-gauge'
import { RfmMatrix } from '@/components/analytics/rfm-matrix'
import { ChurnTable } from '@/components/analytics/churn-table'
import { ActionPlan } from '@/components/analytics/action-plan'
import { NpsTrendChart } from '@/components/analytics/nps-trend-chart'
import { WeeklyDemandChart, HourlyDemandChart, MonthlyTrendChart } from '@/components/analytics/demand-chart'
import {
  buildRfmMatrix, buildChurnTable, buildWeeklyDemand,
  buildHourlyDemand, buildMonthlyTrend, buildNpsTrend, buildActionPlan
} from '@/lib/analytics/engine'
import { getNpsColor, getNpsWord, getComplianceLabel } from '@/lib/utils/formatters'
import { computePatientScore } from '@/lib/utils/patient-scores'
import { Brain, TrendingUp, Users, AlertTriangle, BarChart3, Target, BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePlan } from '@/lib/plans/use-plan'
import { UpgradeGate } from '@/components/ui/upgrade-gate'
import type { Patient, Appointment, NpsResponse } from '@/lib/types'

const fade = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.22 } },
})

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center">
        <BarChart2 size={26} className="text-[var(--subtle)]" />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[var(--foreground)]">Sin datos todavía</p>
        <p className="text-[13px] text-[var(--subtle)] mt-1 max-w-sm">
          Los análisis aparecen automáticamente cuando haya pacientes, turnos y respuestas NPS cargados en el sistema.
        </p>
      </div>
    </div>
  )
}

export function AnalyticsContent() {
  const { hasAnalytics } = usePlan()
  const [patients,     setPatients]     = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [npsData,      setNpsData]      = useState<NpsResponse[]>([])
  const [loading,      setLoading]      = useState(true)

  if (!hasAnalytics) {
    return <UpgradeGate feature="Analytics" requiredPlan="Pro" description="Los reportes RFM, NPS, churn y demanda están disponibles en el plan Pro o superior." />
  }

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('patients').select('*').eq('is_active', true),
      sb.from('appointments').select('*, patient:patients(*), professional:professionals(*)'),
      sb.from('nps_responses').select('*').order('created_at', { ascending: true }),
    ]).then(([pRes, aRes, nRes]) => {
      setPatients((pRes.data as Patient[]) ?? [])
      setAppointments((aRes.data as Appointment[]) ?? [])
      setNpsData((nRes.data as NpsResponse[]) ?? [])
      setLoading(false)
    })
  }, [])

  const hasData = patients.length > 0 || appointments.length > 0

  const nps = useMemo(() => {
    if (!npsData.length) return { score: 0, promoters: 0, neutrals: 0, detractors: 0, total: 0 }
    const promoters  = npsData.filter(n => n.score >= 9).length
    const neutrals   = npsData.filter(n => n.score >= 7 && n.score <= 8).length
    const detractors = npsData.filter(n => n.score <= 6).length
    const score = Math.round(((promoters - detractors) / npsData.length) * 100)
    return { score, promoters, neutrals, detractors, total: npsData.length }
  }, [npsData])

  const rfm      = useMemo(() => buildRfmMatrix(patients, appointments), [patients, appointments])
  const churn    = useMemo(() => buildChurnTable(patients, appointments), [patients, appointments])
  const weekly   = useMemo(() => buildWeeklyDemand(appointments), [appointments])
  const hourly   = useMemo(() => buildHourlyDemand(appointments), [appointments])
  const monthly  = useMemo(() => buildMonthlyTrend(appointments), [appointments])
  const npsTrend = useMemo(() => buildNpsTrend(npsData), [npsData])
  const actions  = useMemo(() => buildActionPlan(patients, appointments, npsData), [patients, appointments, npsData])

  const patientScores = useMemo(() =>
    patients.map(p => computePatientScore(p.id, appointments.filter(a => a.patient_id === p.id))),
  [patients, appointments])

  const avgCompliance = patientScores.reduce((s, p) => s + p.attendance_rate, 0) / (patientScores.length || 1)
  const cancelRate    = appointments.filter(a => a.status === 'cancelled').length / (appointments.length || 1)
  const compLabel     = getComplianceLabel(avgCompliance)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasData) return <EmptyState />

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Business Intelligence</h1>
        <p className="text-[13px] text-[var(--subtle)] mt-0.5">
          Análisis profundo · {patients.length} pacientes · {appointments.length} turnos · {npsData.length} respuestas NPS
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div {...fade(0)}><StatCard label="NPS Score"     value={nps.score}                            sub={getNpsWord(nps.score)}                         icon={TrendingUp}    iconColor={getNpsColor(nps.score)} /></motion.div>
        <motion.div {...fade(1)}><StatCard label="Cumplimiento" value={`${Math.round(avgCompliance*100)}%`}   sub={compLabel.label}                               icon={Target}        iconColor={compLabel.color} /></motion.div>
        <motion.div {...fade(2)}><StatCard label="En riesgo"    value={churn.length}                          sub="pacientes con riesgo de churn"                 icon={AlertTriangle} iconColor="#f59e0b" /></motion.div>
        <motion.div {...fade(3)}><StatCard label="Cancelaciones" value={`${Math.round(cancelRate*100)}%`}     sub={cancelRate > 0.25 ? 'Tasa elevada ⚠' : 'Bajo control ✓'} icon={BarChart3} iconColor={cancelRate > 0.25 ? '#ef4444' : '#10b981'} /></motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <motion.div {...fade(4)} className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-[var(--brand)]" />
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Plan de acción prioritario</h2>
          </div>
          <ActionPlan actions={actions} />
        </motion.div>

        <motion.div {...fade(5)} className="card p-5">
          <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-4">Net Promoter Score</h2>
          <NpsGauge
            score={nps.score}
            promoters={nps.promoters}
            neutrals={nps.neutrals}
            detractors={nps.detractors}
            total={nps.total}
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <motion.div {...fade(6)} className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[var(--brand)]" />
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Matriz RFM — Segmentación de pacientes</h2>
          </div>
          <RfmMatrix data={rfm} />
        </motion.div>

        <motion.div {...fade(7)} className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-[#f59e0b]" />
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Predicción de abandono (Churn)</h2>
          </div>
          <div className="max-h-[280px] overflow-y-auto pr-1">
            <ChurnTable data={churn} />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <motion.div {...fade(8)} className="card p-5">
          <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-4">Demanda semanal</h2>
          <WeeklyDemandChart data={weekly} />
        </motion.div>

        <motion.div {...fade(9)} className="card p-5">
          <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-1">Horarios pico</h2>
          <p className="text-[11px] text-[var(--subtle)] mb-4">08:00 – 19:00hs</p>
          <HourlyDemandChart data={hourly} />
          <div className="flex gap-3 mt-3 text-[10px] text-[var(--subtle)]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#ef4444] inline-block" /> Alto</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#f59e0b] inline-block" /> Medio</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#6366f1] inline-block" /> Normal</span>
          </div>
        </motion.div>

        <motion.div {...fade(10)} className="card p-5">
          <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-4">Tendencia NPS</h2>
          <NpsTrendChart data={npsTrend} />
        </motion.div>
      </div>

      <motion.div {...fade(11)} className="card p-5">
        <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-4">Evolución mensual de turnos</h2>
        <MonthlyTrendChart data={monthly} />
      </motion.div>
    </div>
  )
}
