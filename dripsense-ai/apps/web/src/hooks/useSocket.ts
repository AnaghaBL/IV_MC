import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { socket } from "../services/socket";

interface TelemetrySocketPayload {
  patientId: string;
  sessionId: string;
}

export const useSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    socket.connect();
    const invalidatePatients = () => void queryClient.invalidateQueries({ queryKey: ["patients"] });
    const invalidateTelemetry = (payload: TelemetrySocketPayload) => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: ["patient", payload.patientId] });
      void queryClient.invalidateQueries({ queryKey: ["telemetry", payload.sessionId] });
    };
    socket.on("telemetry:update", invalidateTelemetry);
    socket.on("alert:new", invalidatePatients);
    socket.on("device:status", invalidatePatients);
    return () => {
      socket.off("telemetry:update", invalidateTelemetry);
      socket.off("alert:new", invalidatePatients);
      socket.off("device:status", invalidatePatients);
      socket.disconnect();
    };
  }, [queryClient]);
};
