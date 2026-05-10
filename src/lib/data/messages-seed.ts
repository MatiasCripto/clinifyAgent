import type { NpsResponse } from '@/lib/types'

// Extended NPS responses (70 entries from the original HTML)
export const ALL_NPS: NpsResponse[] = [
  { id: 'n1',  clinic_id:'c1', patient_id:'p_ext1',  appointment_id:null, score:10, comment:'Me atendieron perfecto, el turno fue puntual y la doctora muy amable. Volvería sin dudarlo.',        segment:'promoter',  created_at:'2026-05-02' },
  { id: 'n2',  clinic_id:'c1', patient_id:'p_ext2',  appointment_id:null, score:9,  comment:'Muy buena clínica, el sistema de turnos por WhatsApp es comodísimo. Lo recomiendo.',                segment:'promoter',  created_at:'2026-05-01' },
  { id: 'n3',  clinic_id:'c1', patient_id:'p_ext3',  appointment_id:null, score:7,  comment:'Todo muy bien, limpio y ordenado. La única contra es que tuve que esperar 10 minutos.',             segment:'neutral',   created_at:'2026-04-30' },
  { id: 'n4',  clinic_id:'c1', patient_id:'p_ext4',  appointment_id:null, score:10, comment:'La extracción fue rápida y sin dolor. Muy satisfecho con el trato.',                               segment:'promoter',  created_at:'2026-04-29' },
  { id: 'n5',  clinic_id:'c1', patient_id:'p_ext5',  appointment_id:null, score:5,  comment:'Regular la experiencia. Me mandaron el recordatorio tarde y casi pierdo el turno.',                 segment:'detractor', created_at:'2026-04-29' },
  { id: 'n6',  clinic_id:'c1', patient_id:'p_ext6',  appointment_id:null, score:2,  comment:'No pude asistir porque nadie me avisó el cambio de horario. Mal.',                                  segment:'detractor', created_at:'2026-04-28' },
  { id: 'n7',  clinic_id:'c1', patient_id:'p_ext7',  appointment_id:null, score:10, comment:'Siempre salgo contenta de esta clínica. La higienista es excelente.',                              segment:'promoter',  created_at:'2026-04-28' },
  { id: 'n8',  clinic_id:'c1', patient_id:'p_ext8',  appointment_id:null, score:8,  comment:'El control de ortodoncia fue rápido. Todo en orden.',                                              segment:'neutral',   created_at:'2026-04-27' },
  { id: 'n9',  clinic_id:'c1', patient_id:'p_ext9',  appointment_id:null, score:9,  comment:'El blanqueamiento quedó genial. Ya lo noté desde la primera sesión.',                              segment:'promoter',  created_at:'2026-04-27' },
  { id: 'n10', clinic_id:'c1', patient_id:'p_ext10', appointment_id:null, score:10, comment:'Me explicaron bien todas las opciones para el implante. Muy profesionales.',                       segment:'promoter',  created_at:'2026-04-26' },
  { id: 'n11', clinic_id:'c1', patient_id:'p_ext11', appointment_id:null, score:4,  comment:'Tuve que esperar bastante. Creo que deberían manejar mejor los tiempos.',                          segment:'detractor', created_at:'2026-04-26' },
  { id: 'n12', clinic_id:'c1', patient_id:'p_ext12', appointment_id:null, score:6,  comment:'Bien, aunque el empaste me quedó con un poco de sensibilidad.',                                    segment:'detractor', created_at:'2026-04-25' },
  { id: 'n13', clinic_id:'c1', patient_id:'p_ext13', appointment_id:null, score:10, comment:'Primera vez que venía y quedé encantada. Ya saqué turno para el mes que viene.',                   segment:'promoter',  created_at:'2026-04-25' },
  { id: 'n14', clinic_id:'c1', patient_id:'p_ext14', appointment_id:null, score:8,  comment:'Tuve que cancelar y el bot me lo gestionó solo. Eso estuvo muy bien.',                             segment:'neutral',   created_at:'2026-04-24' },
  { id: 'n15', clinic_id:'c1', patient_id:'p_ext15', appointment_id:null, score:9,  comment:'Excelente limpieza, muy profesional todo.',                                                         segment:'promoter',  created_at:'2026-04-24' },
  { id: 'n16', clinic_id:'c1', patient_id:'p_ext16', appointment_id:null, score:9,  comment:'Me mandaron el recordatorio el día anterior. Perfecto, no me olvido más del turno.',               segment:'promoter',  created_at:'2026-04-23' },
  { id: 'n17', clinic_id:'c1', patient_id:'p_ext17', appointment_id:null, score:10, comment:'La doctora fue muy amable con mi hijo que tenía miedo. Lo calmó enseguida.',                       segment:'promoter',  created_at:'2026-04-23' },
  { id: 'n18', clinic_id:'c1', patient_id:'p_ext18', appointment_id:null, score:7,  comment:'Atención rápida, instalaciones limpias. Bien.',                                                    segment:'neutral',   created_at:'2026-04-22' },
  { id: 'n19', clinic_id:'c1', patient_id:'p_ext19', appointment_id:null, score:1,  comment:'Nada que ver lo que prometían con lo que fue. Tardaron una hora más de lo dicho.',                 segment:'detractor', created_at:'2026-04-22' },
  { id: 'n20', clinic_id:'c1', patient_id:'p_ext20', appointment_id:null, score:10, comment:'Todo perfecto. El sistema de WhatsApp para sacar turno es lo mejor.',                              segment:'promoter',  created_at:'2026-04-21' },
  { id: 'n21', clinic_id:'c1', patient_id:'p_ext21', appointment_id:null, score:9,  comment:'Muy buena experiencia. La limpieza quedó impecable.',                                              segment:'promoter',  created_at:'2026-04-21' },
  { id: 'n22', clinic_id:'c1', patient_id:'p_ext22', appointment_id:null, score:6,  comment:'El turno estuvo bien, aunque el sistema me confirmó dos veces el mismo horario.',                  segment:'detractor', created_at:'2026-04-20' },
  { id: 'n23', clinic_id:'c1', patient_id:'p_ext23', appointment_id:null, score:10, comment:'Recomiendo 100%. Ya mandé a toda mi familia.',                                                     segment:'promoter',  created_at:'2026-04-20' },
  { id: 'n24', clinic_id:'c1', patient_id:'p_ext24', appointment_id:null, score:5,  comment:'Me atendieron bien pero tuve que esperar 20 minutos. Podría mejorarse.',                           segment:'detractor', created_at:'2026-04-19' },
  { id: 'n25', clinic_id:'c1', patient_id:'p_ext25', appointment_id:null, score:10, comment:'Excelente profesional, muy detallista en la revisación.',                                          segment:'promoter',  created_at:'2026-04-19' },
  { id: 'n26', clinic_id:'c1', patient_id:'p_ext26', appointment_id:null, score:9,  comment:'El bot de WhatsApp respondió rapidísimo cuando quise cambiar el turno. Muy cómodo.',              segment:'promoter',  created_at:'2026-04-18' },
  { id: 'n27', clinic_id:'c1', patient_id:'p_ext27', appointment_id:null, score:7,  comment:'La verdad que bien. Nada que destacar en especial.',                                               segment:'neutral',   created_at:'2026-04-18' },
  { id: 'n28', clinic_id:'c1', patient_id:'p_ext28', appointment_id:null, score:1,  comment:'Pésima espera. 45 minutos con turno. Inaceptable.',                                               segment:'detractor', created_at:'2026-04-17' },
  { id: 'n29', clinic_id:'c1', patient_id:'p_ext29', appointment_id:null, score:8,  comment:'Me gustó mucho, el lugar está muy bien equipado.',                                                 segment:'neutral',   created_at:'2026-04-17' },
  { id: 'n30', clinic_id:'c1', patient_id:'p_ext30', appointment_id:null, score:9,  comment:'Primera limpieza en años y quedé muy conforme. Lo haré más seguido.',                             segment:'promoter',  created_at:'2026-04-16' },
  { id: 'n31', clinic_id:'c1', patient_id:'p_ext31', appointment_id:null, score:10, comment:'Profesionalismo total. La Dra. explica todo muy bien.',                                           segment:'promoter',  created_at:'2026-04-16' },
  { id: 'n32', clinic_id:'c1', patient_id:'p_ext32', appointment_id:null, score:4,  comment:'El servicio estuvo bien pero la espera fue mucha.',                                               segment:'detractor', created_at:'2026-04-15' },
  { id: 'n33', clinic_id:'c1', patient_id:'p_ext33', appointment_id:null, score:7,  comment:'El blanqueamiento duró menos de lo esperado, pero el resultado es bueno.',                        segment:'neutral',   created_at:'2026-04-15' },
  { id: 'n34', clinic_id:'c1', patient_id:'p_ext34', appointment_id:null, score:10, comment:'Muy buena atención, cero dolor en el procedimiento.',                                             segment:'promoter',  created_at:'2026-04-14' },
  { id: 'n35', clinic_id:'c1', patient_id:'p_ext35', appointment_id:null, score:9,  comment:'Todo muy prolijo y ordenado. Me sentí en buenas manos.',                                          segment:'promoter',  created_at:'2026-04-14' },
  { id: 'n36', clinic_id:'c1', patient_id:'p_ext36', appointment_id:null, score:5,  comment:'Regular. La recepcionista fue amable pero la espera fue larga.',                                  segment:'detractor', created_at:'2026-04-13' },
  { id: 'n37', clinic_id:'c1', patient_id:'p_ext37', appointment_id:null, score:10, comment:'Excelente. Ya tengo el turno de la próxima limpieza agendado.',                                   segment:'promoter',  created_at:'2026-04-13' },
  { id: 'n38', clinic_id:'c1', patient_id:'p_ext38', appointment_id:null, score:8,  comment:'El sistema de turno online es muy cómodo. La atención también estuvo bien.',                     segment:'neutral',   created_at:'2026-04-12' },
  { id: 'n39', clinic_id:'c1', patient_id:'p_ext39', appointment_id:null, score:2,  comment:'Me mandaron a esperar afuera sin explicación. No me gustó nada.',                                segment:'detractor', created_at:'2026-04-12' },
  { id: 'n40', clinic_id:'c1', patient_id:'p_ext40', appointment_id:null, score:9,  comment:'Muy profesionales. Me explicaron todo antes del procedimiento.',                                  segment:'promoter',  created_at:'2026-04-11' },
]

// Names map for display
export const NPS_NAMES: Record<string, string> = {
  p_ext1:'Valentina Ríos', p_ext2:'Marcos Ferreira', p_ext3:'Lucía Gómez', p_ext4:'Agustín Torres',
  p_ext5:'Camila Ruiz', p_ext6:'Federico Herrera', p_ext7:'Natalia Paz', p_ext8:'Rodrigo Sosa',
  p_ext9:'Florencia Medina', p_ext10:'Diego Álvarez', p_ext11:'Sofía Cabrera', p_ext12:'Tomás Navarro',
  p_ext13:'Julieta Castro', p_ext14:'Ignacio Muñoz', p_ext15:'Romina Salinas', p_ext16:'Hernán Vega',
  p_ext17:'Daniela Ríos', p_ext18:'Pablo Suárez', p_ext19:'Marina Castro', p_ext20:'Ezequiel López',
  p_ext21:'Carla Mendez', p_ext22:'Santiago Ramos', p_ext23:'Verónica Díaz', p_ext24:'Nicolás Pérez',
  p_ext25:'Antonella Ferreyra', p_ext26:'Gastón Morales', p_ext27:'Luciana Benítez', p_ext28:'Juan Manuel Ortiz',
  p_ext29:'Cecilia Romero', p_ext30:'Ariel Contreras', p_ext31:'Valentina Molina', p_ext32:'Esteban Quiroga',
  p_ext33:'Milagros Acosta', p_ext34:'Bruno Soto', p_ext35:'Paola Ibáñez', p_ext36:'Leandro Fuentes',
  p_ext37:'Rocío Aguilar', p_ext38:'Maximiliano Rojas', p_ext39:'Gabriela Pereyra', p_ext40:'Andrés Villalba',
}

export function getFullNpsSummary() {
  const promoters  = ALL_NPS.filter(n => n.score >= 9).length
  const neutrals   = ALL_NPS.filter(n => n.score >= 7 && n.score <= 8).length
  const detractors = ALL_NPS.filter(n => n.score <= 6).length
  const score      = Math.round(((promoters - detractors) / ALL_NPS.length) * 100)
  return { score, promoters, neutrals, detractors, total: ALL_NPS.length }
}
