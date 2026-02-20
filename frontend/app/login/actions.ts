"use server";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    // Re-throw Next.js redirect errors — they carry a special digest and must propagate
    if (
      error instanceof Error &&
      "digest" in error &&
      typeof (error as { digest?: string }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    if (error instanceof AuthError) {
      return "Invalid email or password.";
    }
    // Catch-all: bcryptjs throws on empty/invalid hash, unexpected config errors, etc.
    console.error("Login error:", error);
    return "Something went wrong. Please try again.";
  }
  return null;
}
