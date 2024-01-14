import { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "remix-typedjson";
import { z } from "zod";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { formatZodError, requireUser, requireUserBelongsToTeam } from "~/lib/utils.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const teamId = params.id!;

  const user = await requireUser({ request });
  const team = await requireUserBelongsToTeam(user.id, teamId);

  const url = new URL(request.url);
  const data = Object.fromEntries(url.searchParams);
  const result = z
    .object({
      signerUuid: z.string().min(1),
      fid: z.string().min(1),
    })
    .safeParse(data);

  if (!result.success) {
    console.error("Invalid params", formatZodError(result.error));
    throw redirect("/403");
  }

  if (result.data.fid !== user.id) {
    console.error("User fids does not match", result.data.fid, user);
    throw redirect("/403");
  }

  await Promise.all([
    db.grant.upsert({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId: team.id,
        },
      },
      create: {
        userId: user.id,
        teamId: team.id,
      },
      update: {},
    }),
    db.user.update({
      where: {
        id: user.id,
      },
      data: {
        signerUuid: result.data.signerUuid,
      },
    }),
  ]);

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", {
    type: "success",
    message: `Connected! Ghostwriters can now cast as @${user.username}`,
  });

  return redirect(`/~/teams/${team.id}`, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
