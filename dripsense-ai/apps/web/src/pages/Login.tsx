import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Stethoscope, Wifi } from "lucide-react";
import { Button } from "../components/ui/Button";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth";

const schema = z.object({
  email: z.string().email("Enter a hospital email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().default(true)
});

type LoginForm = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const { register, handleSubmit, formState } = useForm<LoginForm>({ resolver: zodResolver(schema), defaultValues: { remember: true } });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const response = await api.login(values);
      setSession(response.staff, response.accessToken);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-medical-bg px-4 py-10 dark:bg-zinc-950">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg border border-medical-border bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <Stethoscope className="h-7 w-7 text-medical-blue" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">DripSense AI</h1>
          <p className="mt-1 text-sm text-medical-muted">Intelligent Infusion Safety</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div className="flex items-center gap-2 rounded-md bg-medical-green-light px-3 py-2 text-xs font-medium text-medical-green dark:bg-green-950/30">
            <Wifi className="h-4 w-4" /> Hospital network connected
          </div>
          <label className="block text-sm font-medium">
            Email
            <input className="focusable mt-1 h-11 w-full rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950" type="email" {...register("email")} />
            <span className="mt-1 block text-xs text-medical-red">{formState.errors.email?.message}</span>
          </label>
          <label className="block text-sm font-medium">
            Password
            <input className="focusable mt-1 h-11 w-full rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950" type="password" {...register("password")} />
            <span className="mt-1 block text-xs text-medical-red">{formState.errors.password?.message}</span>
          </label>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-medical-muted"><input type="checkbox" {...register("remember")} /> Remember this device</label>
            <button type="button" className="focusable rounded text-sm font-semibold text-medical-blue" onClick={() => setForgotOpen(true)}>Forgot password?</button>
          </div>
          {error && <div className="rounded-md border border-red-200 bg-medical-red-light px-3 py-2 text-sm text-medical-red">{error}</div>}
          <Button type="submit" variant="primary" className="w-full" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Signing in..." : "Sign in"}</Button>
        </form>
        {forgotOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="card w-full max-w-md p-6">
              <h2 className="text-lg font-semibold">Reset password</h2>
              <p className="mt-1 text-sm text-medical-muted">Enter your email, the OTP from IT, then choose a new password.</p>
              <div className="mt-4 grid gap-3">
                <input className="focusable h-10 rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder="email@hospital.org" />
                <input className="focusable h-10 rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder="OTP" />
                <input className="focusable h-10 rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder="New password" type="password" />
                <div className="flex justify-end gap-2"><Button onClick={() => setForgotOpen(false)}>Cancel</Button><Button variant="primary">Update password</Button></div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
