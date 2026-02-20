"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <form className="flex w-80 flex-col gap-4" action={formAction}>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Password" required />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
