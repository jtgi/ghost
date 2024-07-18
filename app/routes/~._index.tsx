/* eslint-disable react/no-unescaped-entities */
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";

import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  requireUser,
  successResponse,
} from "~/lib/utils.server";
import { Form, Link } from "@remix-run/react";
import { db } from "~/lib/db.server";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

const actionTypes = ["degen", "ham"] as const;
export type ActionType = (typeof actionTypes)[number];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const teams = await db.team.findMany({
    where: {
      teammates: {
        some: {
          userId: user.id,
        },
      },
    },
    include: {
      teammates: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  return typedjson({
    user,
    teams,
    env: getSharedEnv(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser({ request });
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const result = z
    .object({
      name: z.string().min(1),
    })
    .safeParse(data);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
    });
  }

  const team = await db.team.create({
    data: {
      name: result.data.name,
    },
  });

  await db.teammate.create({
    data: {
      teamId: team.id,
      userId: user.id,
    },
  });

  return redirect(`/~/teams/${team.id}`);
}

export default function Screen() {
  const { teams } = useTypedLoaderData<typeof loader>();

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="font-medium">Teams</h2>
        <NewTeamButton />
      </div>
      <div className="divide-y space-y-2">
        {teams.map((t) => (
          <Link
            key={t.id}
            to={`/~/teams/${t.id}`}
            className="block p-4 border border-gray-200 rounded-lg no-underline hover:border-gray-400 flex items-center justify-between gap-4"
          >
            <p className="font-semibold text-xl"> {t.name}</p>
            <div className="flex -space-x-1">
              {t.teammates.slice(0, 5).map((teammate) => (
                <Avatar key={teammate.id} className="ring-2 ring-white h-8 w-8">
                  <AvatarImage src={teammate.user.avatarUrl ?? undefined} alt={teammate.user.username} />
                  <AvatarFallback>{teammate.user.username}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NewTeamButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ New Team</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Team</DialogTitle>
          <DialogDescription>Enter a name for your new team</DialogDescription>
        </DialogHeader>
        <Form method="post" className="space-y-4">
          <Input name="name" required />

          <Button className="w-full sm:w-auto">Create</Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
