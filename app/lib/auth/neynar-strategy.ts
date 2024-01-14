import { User } from "@prisma/client";
import { AuthenticateOptions, Strategy } from "remix-auth";
import { SessionStorage } from "@remix-run/node";
import { neynar } from "../neynar.server";
import { User as NeynarUser } from "@neynar/nodejs-sdk/build/neynar-api/v2";

export class NeynarStrategy extends Strategy<
  User,
  { signerUuid: string; farcasterUser: NeynarUser } & { request: Request }
> {
  name = "neynar";

  async authenticate(
    request: Request,
    sessionStorage: SessionStorage,
    options: AuthenticateOptions
  ): Promise<User> {
    const url = new URL(request.url);
    const credentials = Object.fromEntries(url.searchParams.entries());

    if (!credentials.signerUuid || !credentials.fid) {
      return await this.failure("Missing signer uuid or fid", request, sessionStorage, options);
    }

    const signerStatus = await neynar.lookupSigner(credentials.signerUuid);

    const success = signerStatus.status === "approved" && String(signerStatus.fid) === credentials.fid;
    if (!success) {
      return await this.failure("Credentials are invalid. Sign in again.", request, sessionStorage, options);
    }

    const farcasterUser = await neynar.fetchBulkUsers([signerStatus.fid!]).catch(() => null);
    if (!farcasterUser || !farcasterUser.users.length) {
      return await this.failure(
        `User with fid ${signerStatus.fid} not found`,
        request,
        sessionStorage,
        options
      );
    }

    let user;
    try {
      user = await this.verify({
        farcasterUser: farcasterUser.users[0],
        signerUuid: credentials.signerUuid,
        request,
      });
    } catch (err) {
      console.error(err);
      return await this.failure((err as Error).message, request, sessionStorage, options);
    }

    return this.success(user, request, sessionStorage, options);
  }
}
