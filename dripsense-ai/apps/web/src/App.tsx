import { Navigate, Route, Routes } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppShell } from "./components/layout/AppShell";
import { useAuthStore } from "./store/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PatientDetail from "./pages/PatientDetail";
import Alerts from "./pages/Alerts";
import Analytics from "./pages/Analytics";
import Devices from "./pages/Devices";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NurseMobile from "./pages/NurseMobile";
import { useSocket } from "./hooks/useSocket";

const Protected = () => {
  const isAuthed = useAuthStore((state) => state.isAuthed);
  return isAuthed ? <AppShell /> : <Navigate to="/login" replace />;
};

const Page = ({ children }: { children: React.ReactNode }) => (
  <AnimatePresence mode="wait">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      {children}
    </motion.div>
  </AnimatePresence>
);

export default function App() {
  useSocket();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<Page><Dashboard /></Page>} />
        <Route path="/patients/:id" element={<Page><PatientDetail /></Page>} />
        <Route path="/alerts" element={<Page><Alerts /></Page>} />
        <Route path="/analytics" element={<Page><Analytics /></Page>} />
        <Route path="/devices" element={<Page><Devices /></Page>} />
        <Route path="/reports" element={<Page><Reports /></Page>} />
        <Route path="/settings" element={<Page><Settings /></Page>} />
        <Route path="/mobile" element={<Page><NurseMobile /></Page>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
