import { create } from 'zustand';

export const useStore = create((set) => ({
  user: null, // { id, name, role: 'worker' | 'admin' }
  location: null, // { lat, lng, timestamp }
  trackingActive: false,
  workers: [], // for admin view
  
  login: (userData) => set({ user: userData }),
  logout: () => set({ user: null, location: null, trackingActive: false }),
  
  setLocation: (loc) => set({ location: loc }),
  setTrackingActive: (isActive) => set({ trackingActive: isActive }),
  
  // Mock function to update workers for admin dashboard
  updateWorkerLocation: (workerId, loc) => set((state) => {
    const existing = state.workers.find(w => w.id === workerId);
    if (existing) {
      return {
        workers: state.workers.map(w => w.id === workerId ? { ...w, location: loc } : w)
      };
    } else {
      return {
        workers: [...state.workers, { id: workerId, name: `Worker ${workerId}`, location: loc }]
      };
    }
  })
}));
