"use client";

import { createAuthClient } from "better-auth/react";
import {
  anonymousClient,
  emailOTPClient,
  magicLinkClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), emailOTPClient(), anonymousClient()],
});

export const { useSession, signIn, signOut } = authClient;
