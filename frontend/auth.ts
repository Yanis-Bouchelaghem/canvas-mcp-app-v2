import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: {
    error: () => {}, // suppress NextAuth's verbose stack traces
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials.email as string;
        console.log(`[auth] login attempt from: ${email}`);
        if (
          credentials.email !== process.env.AUTH_EMAIL ||
          credentials.password !== process.env.AUTH_PASSWORD
        ) {
          console.log(`[auth] login failed for: ${email}`);
          return null;
        }
        console.log(`[auth] login success for: ${email}`);
        return { id: "1", email };
      },
    }),
  ],
  pages: { signIn: "/login" },
});
