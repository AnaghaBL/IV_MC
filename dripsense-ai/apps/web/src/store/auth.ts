import { create } from "zustand";
import type { Staff } from "../types/domain";
import { setAccessToken } from "../services/api";

interface AuthState {
  staff: Staff | null;
  isAuthed: boolean;
  setSession: (staff: Staff, token: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  staff: null,
  isAuthed: Boolean(localStorage.getItem("dripsense.accessToken")),
  setSession: (staff, token) => {
    setAccessToken(token);
    set({ staff, isAuthed: true });
  },
  clearSession: () => {
    setAccessToken(null);
    set({ staff: null, isAuthed: false });
  }
}));
