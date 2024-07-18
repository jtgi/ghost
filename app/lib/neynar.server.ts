import { NeynarAPIClient } from "@neynar/nodejs-sdk";

import { cache } from "./cache.server";
import { FollowResponseUser, Reaction } from "@neynar/nodejs-sdk/build/neynar-api/v1";
import { Channel, User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import axios from "axios";
import { getSharedEnv } from "./utils.server";
export const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY!);

export async function* pageChannelCasts(props: { id: string }) {
  let cursor: string | null | undefined = undefined;

  while (cursor !== null) {
    const response = await neynar.fetchFeedByChannelIds([props.id], {
      limit: 100,
      cursor,
    });

    yield response;
    cursor = response.next.cursor;
  }
}

export async function getChannel(props: { name: string }) {
  const cacheKey = `channel:${props.name}`;
  const cached = cache.get<Channel>(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await neynar.lookupChannel(props.name);
  cache.set(cacheKey, response.channel, process.env.NODE_ENV === "development" ? 0 : 60 * 60 * 24);

  return response.channel;
}

export async function getUser(props: { fid: string }) {
  const cacheKey = `user:${props.fid}`;
  const cached = cache.get<User>(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await neynar.fetchBulkUsers([+props.fid], {});
  cache.set(cacheKey, response.users[0], process.env.NODE_ENV === "development" ? 0 : 60 * 60);

  return response.users[0];
}

export async function pageReactionsDeep(props: { hash: string }) {
  const cacheKey = `reactions:${props.hash}`;
  const cached = cache.get<Array<Reaction>>(cacheKey);

  if (cached) {
    return cached;
  }

  let results: Array<Reaction> = [];
  let cursor: string | null | undefined = undefined;

  while (cursor !== null) {
    const response = await neynar.fetchCastReactions(props.hash, {
      limit: 150,
      cursor,
    });

    results = results.concat(response.result.casts);
    cursor = response.result.next.cursor;
  }

  cache.set(cacheKey, results);
  return results;
}

export async function pageFollowersDeep(props: { fid: number }) {
  const cacheKey = `followers:${props.fid}`;
  const cached = cache.get<Array<FollowResponseUser>>(cacheKey);

  if (cached) {
    return cached;
  }

  let results: Array<FollowResponseUser> = [];
  let cursor: string | null | undefined = undefined;

  while (cursor !== null) {
    const response = await neynar.fetchUserFollowers(props.fid, {
      limit: 150,
      cursor: cursor || undefined,
    });

    results = results.concat(response.result.users);
    cursor = cursor !== response.result.next.cursor ? response.result.next.cursor : null;
  }

  cache.set(cacheKey, results);
  return results;
}
