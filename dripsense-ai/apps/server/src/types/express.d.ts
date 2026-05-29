import type { AuthStaff } from "./domain.js";

declare global {
  namespace Express {
    interface Request {
      staff?: AuthStaff;
    }
  }
}

export {};
