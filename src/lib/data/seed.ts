// ============================================================
// Demo seed data — mirrors the HTML dashboard seed
// Used when Supabase is not yet connected
// ============================================================
import type { Professional, Patient, Appointment, NpsResponse, Specialty } from '@/lib/types'

export const SEED_SPECIALTIES: Specialty[] = [
  { id: 's1', organization_id: 'org1', name: 'Odontología General', color: '#6366f1', created_at: '' },
  { id: 's2', organization_id: 'org1', name: 'Ortodoncia',           color: '#10b981', created_at: '' },
  { id: 's3', organization_id: 'org1', name: 'Estética Dental',      color: '#f59e0b', created_at: '' },
  { id: 's4', organization_id: 'org1', name: 'Endodoncia',           color: '#ef4444', created_at: '' },
  { id: 's5', organization_id: 'org1', name: 'Pediatría Dental',     color: '#8b5cf6', created_at: '' },
]

export const SEED_PROFESSIONALS: Professional[] = [
  { id: 'd1', organization_id: 'org1', full_name: 'Dra. Laura Méndez',       specialty_id: 's1', phone: '351-4400-001', email: 'lmendez@dentalink.app',      color: '#6366f1', is_active: true, bio: null, license_number: null, avatar_url: null, created_at: '', updated_at: '' },
  { id: 'd2', organization_id: 'org1', full_name: 'Dr. Carlos Villafuerte',  specialty_id: 's2', phone: '351-4400-002', email: 'cvillafuerte@dentalink.app', color: '#10b981', is_active: true, bio: null, license_number: null, avatar_url: null, created_at: '', updated_at: '' },
  { id: 'd3', organization_id: 'org1', full_name: 'Dra. Sofía Ríos',         specialty_id: 's3', phone: '351-4400-003', email: 'srios@dentalink.app',         color: '#f59e0b', is_active: true, bio: null, license_number: null, avatar_url: null, created_at: '', updated_at: '' },
  { id: 'd4', organization_id: 'org1', full_name: 'Dr. Martín Herrera',      specialty_id: 's4', phone: '351-4400-004', email: 'mherrera@dentalink.app',      color: '#ef4444', is_active: true, bio: null, license_number: null, avatar_url: null, created_at: '', updated_at: '' },
  { id: 'd5', organization_id: 'org1', full_name: 'Dra. Paula Castro',       specialty_id: 's5', phone: '351-4400-005', email: 'pcastro@dentalink.app',       color: '#8b5cf6', is_active: true, bio: null, license_number: null, avatar_url: null, created_at: '', updated_at: '' },
]

const P = (id: string, fn: string, ln: string, tel: string, notes = ''): Patient => ({
  id, organization_id: 'org1', first_name: fn, last_name: ln, phone: tel,
  dni: null, email: `${fn.toLowerCase()}@gmail.com`, date_of_birth: null,
  gender: null, address: null, notes: notes || null, whatsapp_id: null,
  is_active: true, created_at: '', updated_at: '',
})

export const SEED_PATIENTS: Patient[] = [
  P('p1',  'Valentina', 'Ríos',     '351-4421-892', 'Alergia a la penicilina'),
  P('p2',  'Marcos',    'Ferreira', '351-4887-234'),
  P('p3',  'Lucía',     'Gómez',    '351-5532-109', 'Ansiedad dental'),
  P('p4',  'Agustín',   'Torres',   '351-4123-876'),
  P('p5',  'Camila',    'Ruiz',     '351-6698-445'),
  P('p6',  'Federico',  'Herrera',  '351-4432-221'),
  P('p7',  'Natalia',   'Paz',      '351-5567-889', 'Bruxismo'),
  P('p8',  'Rodrigo',   'Sosa',     '351-4789-332'),
  P('p9',  'Florencia', 'Medina',   '351-4451-678'),
  P('p10', 'Diego',     'Álvarez',  '351-5512-994', 'Diabetes tipo 2'),
  P('p11', 'Sofía',     'Cabrera',  '351-4398-776'),
  P('p12', 'Tomás',     'Navarro',  '351-6645-213'),
]

const A = (
  id: string, h: string, pid: string, did: string, trat: string,
  status: 'confirmed' | 'pending' | 'cancelled', date: string
): Appointment => {
  const professional = SEED_PROFESSIONALS.find(d => d.id === did)!
  const patient      = SEED_PATIENTS.find(p => p.id === pid)!
  return {
    id, clinic_id: 'c1', patient_id: pid, professional_id: did,
    starts_at: `${date}T${h}:00`, ends_at: `${date}T${h}:30`,
    treatment: trat, status, notes: null, cancellation_reason: null,
    reminder_sent: false, nps_sent: false, google_event_id: null,
    source: 'whatsapp', created_at: '', updated_at: '',
    patient, professional,
  }
}

export const SEED_APPOINTMENTS: Appointment[] = [
  A('t1',  '08:30', 'p1',  'd1', 'Limpieza dental',     'confirmed', '2026-05-05'),
  A('t2',  '09:00', 'p2',  'd2', 'Ortodoncia',          'confirmed', '2026-05-05'),
  A('t3',  '09:30', 'p3',  'd3', 'Blanqueamiento',      'pending',   '2026-05-05'),
  A('t4',  '10:00', 'p4',  'd4', 'Extracción muela',    'confirmed', '2026-05-05'),
  A('t5',  '10:30', 'p5',  'd1', 'Consulta inicial',    'pending',   '2026-05-05'),
  A('t6',  '11:00', 'p6',  'd1', 'Empaste',             'cancelled', '2026-05-05'),
  A('t7',  '11:30', 'p7',  'd1', 'Limpieza dental',     'confirmed', '2026-05-05'),
  A('t8',  '12:00', 'p8',  'd2', 'Control ortodoncia',  'confirmed', '2026-05-05'),
  A('t9',  '14:00', 'p9',  'd3', 'Blanqueamiento',      'pending',   '2026-05-05'),
  A('t10', '14:30', 'p10', 'd1', 'Implante consulta',   'confirmed', '2026-05-05'),
  A('t11', '15:00', 'p11', 'd1', 'Limpieza dental',     'confirmed', '2026-05-05'),
  A('t12', '15:30', 'p12', 'd4', 'Empaste',             'pending',   '2026-05-05'),
  A('t13', '09:00', 'p1',  'd1', 'Limpieza dental',     'confirmed', '2026-04-10'),
  A('t14', '10:00', 'p1',  'd1', 'Limpieza dental',     'cancelled', '2026-03-15'),
  A('t15', '09:30', 'p2',  'd2', 'Ortodoncia control',  'confirmed', '2026-04-20'),
  A('t16', '11:00', 'p3',  'd3', 'Blanqueamiento',      'confirmed', '2026-04-28'),
  A('t17', '08:30', 'p4',  'd4', 'Endodoncia',          'cancelled', '2026-04-05'),
  A('t18', '10:00', 'p5',  'd1', 'Empaste',             'cancelled', '2026-04-12'),
  A('t19', '09:00', 'p6',  'd1', 'Consulta',            'cancelled', '2026-04-18'),
  A('t20', '11:30', 'p7',  'd1', 'Limpieza',            'confirmed', '2026-04-22'),
  A('t21', '16:00', 'p2',  'd2', 'Ortodoncia',          'confirmed', '2026-05-12'),
  A('t22', '10:00', 'p3',  'd3', 'Blanqueamiento',      'pending',   '2026-05-18'),
  A('t23', '09:00', 'p7',  'd1', 'Limpieza',            'confirmed', '2026-05-20'),
  A('t24', '14:00', 'p10', 'd1', 'Implante',            'pending',   '2026-05-22'),
  A('t25', '08:30', 'p1',  'd1', 'Control',             'pending',   '2026-06-05'),
  A('t26', '11:00', 'p4',  'd4', 'Endodoncia',          'confirmed', '2026-06-10'),
  A('t27', '09:30', 'p8',  'd2', 'Ortodoncia',          'pending',   '2026-06-15'),
]

export const SEED_NPS: NpsResponse[] = [
  { id: 'n1',  clinic_id: 'c1', patient_id: 'p1',  appointment_id: null, score: 10, comment: 'Me atendieron perfecto, el turno fue puntual y la doctora muy amable. Volvería sin dudarlo.',        segment: 'promoter',  created_at: '2026-05-02T10:00:00' },
  { id: 'n2',  clinic_id: 'c1', patient_id: 'p2',  appointment_id: null, score: 9,  comment: 'Muy buena clínica, el sistema de turnos por WhatsApp es comodísimo. Lo recomiendo.',                segment: 'promoter',  created_at: '2026-05-01T11:00:00' },
  { id: 'n3',  clinic_id: 'c1', patient_id: 'p3',  appointment_id: null, score: 7,  comment: 'Todo muy bien, limpio y ordenado. La única contra es que tuve que esperar 10 minutos.',             segment: 'neutral',   created_at: '2026-04-30T09:00:00' },
  { id: 'n4',  clinic_id: 'c1', patient_id: 'p4',  appointment_id: null, score: 10, comment: 'La extracción fue rápida y sin dolor. Muy satisfecho con el trato.',                               segment: 'promoter',  created_at: '2026-04-29T14:00:00' },
  { id: 'n5',  clinic_id: 'c1', patient_id: 'p5',  appointment_id: null, score: 5,  comment: 'Regular la experiencia. Me mandaron el recordatorio tarde y casi pierdo el turno.',                 segment: 'detractor', created_at: '2026-04-29T15:00:00' },
  { id: 'n6',  clinic_id: 'c1', patient_id: 'p6',  appointment_id: null, score: 2,  comment: 'No pude asistir porque nadie me avisó el cambio de horario. Mal.',                                  segment: 'detractor', created_at: '2026-04-28T16:00:00' },
  { id: 'n7',  clinic_id: 'c1', patient_id: 'p7',  appointment_id: null, score: 10, comment: 'Siempre salgo contenta de esta clínica. La higienista es excelente.',                              segment: 'promoter',  created_at: '2026-04-28T10:00:00' },
  { id: 'n8',  clinic_id: 'c1', patient_id: 'p8',  appointment_id: null, score: 8,  comment: 'El control de ortodoncia fue rápido. Todo en orden.',                                              segment: 'neutral',   created_at: '2026-04-27T11:00:00' },
  { id: 'n9',  clinic_id: 'c1', patient_id: 'p9',  appointment_id: null, score: 9,  comment: 'El blanqueamiento quedó genial. Ya lo noté desde la primera sesión.',                              segment: 'promoter',  created_at: '2026-04-27T12:00:00' },
  { id: 'n10', clinic_id: 'c1', patient_id: 'p10', appointment_id: null, score: 10, comment: 'Me explicaron bien todas las opciones para el implante. Muy profesionales.',                       segment: 'promoter',  created_at: '2026-04-26T09:00:00' },
]

// Computed NPS from seed
export function getSeedNpsSummary() {
  const all        = SEED_NPS
  const promoters  = all.filter(n => n.score >= 9).length
  const neutrals   = all.filter(n => n.score >= 7 && n.score <= 8).length
  const detractors = all.filter(n => n.score <= 6).length
  const score      = Math.round(((promoters - detractors) / all.length) * 100)
  return { score, promoters, neutrals, detractors, total: all.length }
}
