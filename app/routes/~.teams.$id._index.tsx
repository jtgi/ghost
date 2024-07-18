/* eslint-disable react/no-unescaped-entities */
import { typedjson, useTypedLoaderData } from "remix-typedjson";

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
import { Input } from "~/components/ui/input";
import { z } from "zod";
import { neynar } from "~/lib/neynar.server";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useEffect, useRef } from "react";
import { User } from "@prisma/client";
import { Textarea } from "~/components/ui/textarea";
import { FieldLabel } from "~/components/ui/fields";
import { FarcasterIcon } from "~/components/FarcasterIcon";

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
    return errorResponse({
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
      return errorResponse({
        request,
        message: formatZodError(result.error),
      });
    }

    const rsp = await neynar.lookupUserByUsername(result.data.username).catch(() => null);

    if (!rsp) {
      return errorResponse({
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
    console.log(data);
    const result = z
      .object({
        castContent: z.string().trim().min(1),
        channelId: z.string().optional(),
        embed1: z.preprocess(
          (e) => (e === "" ? undefined : e),
          z
            .string()
            .url()
            .transform((e) => ({ url: e }))
            .optional()
        ),
        embed2: z.preprocess(
          (e) => (e === "" ? undefined : e),
          z
            .string()
            .url()
            .transform((e) => ({ url: e }))
            .optional()
        ),
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
        id: true,
        signerUuid: true,
      },
      where: {
        id: result.data.authorId,
        signerUuid: {
          not: null,
        },
      },
    });

    const embeds = [result.data.embed1, result.data.embed2].filter(Boolean) as { url: string }[];
    const rsp = await neynar.publishCast(authorSigner.signerUuid!, castContent, {
      channelId: result.data.channelId,
      embeds,
    });

    await db.castLog.create({
      data: {
        userId: user.id,
        authorId: authorSigner.id,
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

  return errorResponse({
    request,
    message: "go away",
  });
}

export default function Screen() {
  const { user, team } = useTypedLoaderData<typeof loader>();

  return (
    <div className="space-y-8">
      <div className="pb-2 border-b">
        <p className="uppercase text-[8px]">team</p>
        <h2>{team.name}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <section className="space-y-4 col-span-2">
          <div className="flex items-center justify-between pb-2 border-b">
            <p className="font-medium">Shared Accounts</p>
            <Button size={"sm"} variant={"outline"} asChild>
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
              <div key={grant.id} className="flex items-center gap-4 py-2 justify-between">
                <div className="flex gap-2">
                  <UserInfo user={grant.user} />
                </div>
                <CastComposerButton author={grant.user} ghostwriter={user} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <p className="font-medium">Ghostwriters</p>
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
        <Button size={"sm"} variant={"outline"}>
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
          <Button name="intent" value="addTeammate" disabled={isLoading} className="w-full sm:w-auto">
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
        <Button size={"sm"} className="w-[120px]">
          <FarcasterIcon className="w-4 h-4 mr-1" /> Cast
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Cast</DialogTitle>
        </DialogHeader>

        <Form ref={formRef} method="post" className="space-y-2">
          <fieldset disabled={isLoading} className="space-y-3">
            <input type="hidden" name="authorId" value={props.author.id} />
            <Textarea rows={5} name="castContent" placeholder="something spicy..." required />
            <div>
              <p className="text-gray-500 text-xs">Embed 1</p>
              <Input name="embed1" placeholder="https://example.com" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Embed 2</p>
              <Input name="embed2" placeholder="https://example.com" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Channel</p>
              <Input name="channelId" placeholder="memes" className="rounded-l-none" />
            </div>
          </fieldset>

          <div className="py-4">
            <hr />
          </div>
          <Button name="intent" value="cast" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? "Casting..." : "Cast"}
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
