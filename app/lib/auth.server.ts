import type { User } from "@prisma/client";
import { Authenticator } from "remix-auth";
import { db } from "~/lib/db.server";
import { createCookieSessionStorage } from "@remix-run/node";
import { NeynarStrategy } from "./auth/neynar-strategy";
import { FarcasterStrategy } from "./auth/farcaster-strategy";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [process.env.SESSION_SECRET || "STRONG_SECRET"],
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

export const authenticator = new Authenticator<User>(sessionStorage, {
  throwOnError: true,
});

authenticator.use(
  new NeynarStrategy(async ({ farcasterUser, signerUuid, request }) => {
    const user = await db.user.findFirst({
      where: {
        id: String(farcasterUser.fid),
        signerUuid,
      },
    });

    if (!user) {
      return await db.user.upsert({
        where: {
          id: String(farcasterUser.fid),
        },
        create: {
          id: String(farcasterUser.fid),
          username: farcasterUser.username,
          avatarUrl: farcasterUser.pfp_url,
          signerUuid,
        },
        update: {
          id: String(farcasterUser.fid),
          username: farcasterUser.username,
          avatarUrl: farcasterUser.pfp_url,
          signerUuid,
        },
      });
    }

    return user;
  })
);

export type FarcasterUser = {
  inviteCodeId?: string;
  fid: string;
  username?: string;
  pfpUrl?: string;
};

authenticator.use(new FarcasterStrategy(verifyFarcasterUser));

export async function verifyFarcasterUser(args: FarcasterUser & { request: Request }) {
  const user = await db.user.findFirst({
    where: {
      id: args.fid,
    },
  });

  if (!user) {
    return await db.user.create({
      data: {
        id: args.fid,
        username: args.username || args.fid,
        avatarUrl: args.pfpUrl,
      },
    });
  }

  return user;
}
