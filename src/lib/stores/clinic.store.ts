import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Clinic, Organization } from '@/lib/types'

interface ClinicStore {
  organization: Organization | null
  currentClinic: Clinic | null
  clinics: Clinic[]
  setOrganization: (org: Organization) => void
  setCurrentClinic: (clinic: Clinic) => void
  setClinics: (clinics: Clinic[]) => void
}

export const useClinicStore = create<ClinicStore>()(
  persist(
    (set) => ({
      organization: null,
      currentClinic: null,
      clinics: [],
      setOrganization: (org) => set({ organization: org }),
      setCurrentClinic: (clinic) => set({ currentClinic: clinic }),
      setClinics: (clinics) => set({ clinics }),
    }),
    { name: 'oc-clinic-store' }
  )
)
