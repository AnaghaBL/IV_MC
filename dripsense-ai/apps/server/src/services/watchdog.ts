import type { AppSocketServer } from "../socket/index.js";
import { query } from "../db/pool.js";
import { logger } from "../config/logger.js";
import { describeError } from "../middleware/errors.js";

export const startDeviceWatchdog = (io: AppSocketServer) => {
  setInterval(async () => {
    try {
      const result = await query<{ id: string; wifi_rssi: number | null; battery_level: number | null }>(
        `update devices
         set is_online = false, updated_at = now()
         where is_online = true and (last_seen is null or last_seen < now() - interval '60 seconds')
         returning id, wifi_rssi, battery_level`
      );
      for (const device of result.rows) {
        io.emit("device:status", {
          deviceId: device.id,
          isOnline: false,
          rssi: device.wifi_rssi,
          battery: device.battery_level
        });
      }
    } catch (err) {
      logger.error("watchdog.failed", { error: describeError(err) });
    }
  }, 15_000);
};
