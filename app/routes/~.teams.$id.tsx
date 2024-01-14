/* eslint-disable react/no-unescaped-entities */
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";

import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  requireCanCastAsAuthor,
  requireUser,
  requireUserBelongsToTeam,
  successResponse,
} from "~/lib/utils.server";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { db } from "~/lib/db.server";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { z } from "zod";
import { neynar } from "~/lib/neynar.server";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { User } from "@prisma/client";
import { Textarea } from "~/components/ui/textarea";

const actionTypes = ["degen", "ham"] as const;
export type ActionType = (typeof actionTypes)[number];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const teamId = params.id!;

  const user = await requireUser({ request });
  const team = await requireUserBelongsToTeam(user.id, teamId);

  return typedjson({
    user,
    team,
    env: getSharedEnv(),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const teamId = params.id!;

    const user = await requireUser({ request });
    const team = await requireUserBelongsToTeam(user.id, teamId);

    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    const intent = z
      .object({
        intent: z.enum(["addTeammate", "cast"]),
      })
      .safeParse(data);

    if (!intent.success) {
      throw errorResponse({
        request,
        message: "go away",
      });
    }

    if (intent.data.intent === "addTeammate") {
      const result = z
        .object({
          username: z
            .string()
            .trim()
            .min(1)
            .transform((u) => u.toLowerCase()),
        })
        .safeParse(data);

      if (!result.success) {
        throw errorResponse({
          request,
          message: formatZodError(result.error),
        });
      }

      const rsp = await neynar.lookupUserByUsername(result.data.username).catch(() => null);

      if (!rsp) {
        throw errorResponse({
          request,
          message: `@${result.data.username} not found, try again?`,
        });
      }

      const neynarUser = rsp.result.user;

      const updatedUser = await db.user.upsert({
        where: {
          id: String(neynarUser.fid),
        },
        update: {
          username: neynarUser.username,
          avatarUrl: neynarUser.pfp.url,
        },
        create: {
          id: String(neynarUser.fid),
          username: neynarUser.username,
          avatarUrl: neynarUser.pfp.url,
        },
      });

      await db.teammate.upsert({
        where: {
          userId_teamId: {
            teamId,
            userId: String(neynarUser.fid),
          },
        },
        create: {
          teamId,
          userId: String(neynarUser.fid),
        },
        update: {},
      });

      return successResponse({
        request,
        message: `Added @${updatedUser.username}`,
        data: {
          ok: true,
        },
      });
    } else if (intent.data.intent === "cast") {
      console.log("cast intent");
      const result = z
        .object({
          castContent: z.string().trim().min(1),
          channelId: z.string().optional(),
          embeds: z
            .array(z.string().url())
            .optional()
            .transform((embeds) => embeds?.map((e) => ({ url: e }))),
          authorId: z.string().trim().min(1),
        })
        .safeParse(data);

      if (!result.success) {
        return errorResponse({
          request,
          message: formatZodError(result.error),
        });
      }

      const { castContent, authorId } = result.data;
      await requireCanCastAsAuthor({
        userId: user.id,
        teamId: team.id,
        authorId,
      });

      const authorSigner = await db.user.findFirstOrThrow({
        select: {
          signerUuid: true,
        },
        where: {
          id: result.data.authorId,
          signerUuid: {
            not: null,
          },
        },
      });

      const rsp = await neynar.publishCast(authorSigner.signerUuid!, castContent, {
        channelId: result.data.channelId,
        embeds: result.data.embeds,
      });

      await db.castLog.create({
        data: {
          userId: user.id,
          teamId: team.id,
          castContent,
          hash: rsp.hash,
        },
      });

      return successResponse({
        request,
        message: "Cast published!",
        data: {
          hash: rsp.hash,
        },
      });
    }

    throw errorResponse({
      request,
      message: "go away",
    });
  } catch (e) {
    console.error("caught error", e);
    throw e;
  }
}

export default function Screen() {
  const { user, team } = useTypedLoaderData<typeof loader>();

  return (
    <div className="space-y-8">
      <div className="pb-2 border-b">
        <p className="uppercase text-[8px]">team</p>
        <h2>{team.name}</h2>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3>Accounts</h3>
          <Button size={"sm"} variant={"secondary"} asChild>
            <Link to={`/~/teams/${team.id}/connect`} className="no-underline">
              + Add
            </Link>
          </Button>
        </div>

        <div className="divide-y">
          {team.grants.length === 0 && (
            <div className="py-2 text-gray-400 text-sm">No accounts connected</div>
          )}

          {team.grants.map((grant) => (
            <div key={grant.id} className="flex items-center gap-4 py-2">
              <UserInfo user={grant.user} />
              <CastComposerButton author={grant.user} ghostwriter={user} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3>Ghostwriters</h3>
          <AddTeammateButton />
        </div>
        <div className="divide-y">
          {team.teammates.map((t) => (
            <div key={t.id} className="flex items-center gap-4 py-2">
              <UserInfo user={t.user} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AddTeammateButton() {
  const nav = useNavigation();
  const isLoading = nav.state !== "idle";

  const formRef = useRef<HTMLFormElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  const actionData = useActionData<typeof action>();

  useEffect(() => {
    if (actionData?.data) {
      formRef.current?.reset();
      usernameRef.current?.focus();
    }
  }, [actionData]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={"sm"} variant={"secondary"}>
          + Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Teammate</DialogTitle>
          <DialogDescription>Enter a username</DialogDescription>
        </DialogHeader>

        <Form ref={formRef} method="post" className="space-y-2">
          <fieldset disabled={isLoading}>
            <Input ref={usernameRef} name="username" placeholder="randomeror.eth" required />
          </fieldset>
          <Button name="intent" value="addTeammate" disabled={isLoading}>
            {isLoading ? "Adding..." : "Add"}
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UserInfo(props: { user: User }) {
  return (
    <>
      <Avatar>
        <AvatarImage src={props.user.avatarUrl ?? undefined} alt={props.user.username} />
        <AvatarFallback>{props.user.username[0]}</AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium">{props.user.username}</p>
        <p className="text-gray-400 text-sm">#{props.user.id}</p>
      </div>
    </>
  );
}

function CastComposerButton(props: { author: User; ghostwriter: User }) {
  const nav = useNavigation();
  const isLoading = nav.state !== "idle";

  const formRef = useRef<HTMLFormElement>(null);

  const actionData = useActionData<typeof action>();

  useEffect(() => {
    if (actionData?.data) {
      formRef.current?.reset();
    }
  }, [actionData]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={"sm"} variant={"secondary"}>
          Cast
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Cast</DialogTitle>
        </DialogHeader>

        <Form ref={formRef} method="post" className="space-y-2">
          <fieldset disabled={isLoading} className="space-y-3">
            <input type="hidden" name="authorId" value={props.author.id} />
            <Textarea name="castContent" placeholder="something spicy..." required />
            <div>
              <p className="text-gray-500 text-xs">Channel</p>
              <Input name="channelId" placeholder="memes" className="rounded-l-none" />
            </div>
          </fieldset>

          <div className="py-4">
            <hr />
          </div>
          <Button name="intent" value="cast" disabled={isLoading}>
            {isLoading ? "Casting..." : "Cast"}
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
