// Estado de la vista 3D que no interesa al resto de la app.
import { create } from 'zustand'

export type Filter = 'all' | 'running' | 'waiting' | 'idle'

interface OfficeUI {
  /** Sala enfocada (id de RoomLayout) o null para la vista general. */
  room: string | null
  filter: Filter
  setRoom: (room: string | null) => void
  setFilter: (filter: Filter) => void
}

export const useOffice = create<OfficeUI>()((set) => ({
  room: null,
  filter: 'all',
  setRoom: (room) => set({ room }),
  setFilter: (filter) => set({ filter }),
}))
