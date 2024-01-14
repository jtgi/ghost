import { ClientOnly } from "remix-utils/client-only";
import { AuthKitProvider, SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { getSharedEnv, requireUser, requireUserBelongsToTeam } from "~/lib/utils.server";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticator, commitSession, getSession } from "~/lib/auth.server";
import { ArrowRight, CheckIcon, Loader, Loader2, User } from "lucide-react";
import { Alert } from "~/components/ui/alert";
import { toast } from "sonner";
import { Farcaster } from "~/components/icons/farcaster";
import invariant from "tiny-invariant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const teamId = params.id!;
  const user = await requireUser({ request });
  const team = await requireUserBelongsToTeam(user.id, teamId);
  const env = getSharedEnv();

  return typedjson({
    env,
    user,
    team,
  });
}

export default function Screen() {
  const { env, user, team } = useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);

  const onSuccess = (data: { signer_uuid: string; fid: string }) => {
    setLoggingIn(true);

    const params = new URLSearchParams();
    params.append("signerUuid", data.signer_uuid);
    params.append("fid", data.fid);

    navigate(`/api/teams/${team.id}/connect?${params}`, {
      replace: true,
    });
  };

  useEffect(() => {
    function appendButton() {
      let script = document.getElementById("siwn-script") as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement("script");
        script.id = "siwn-script";
        document.body.appendChild(script);
      }

      script.src = "https://neynarxyz.github.io/siwn/raw/1.2.0/index.js";

      document.body.appendChild(script);
    }

    function bindSignInSuccess() {
      const win = window as any;

      if (!win._onSignInSuccess) {
        win._onSignInSuccess = onSuccess;
      }
    }

    appendButton();
    bindSignInSuccess();
  }, []);

  return (
    <div className="h-full w-full flex flex-col max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Connect your account</CardTitle>
          <CardDescription>
            Requires signer permissions, anyone on your team will be able to cast as you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500">[if you can't see a button here, refresh]</p>
          <div
            className="neynar_signin"
            data-theme="dark"
            data-styles='{ "font-size": "16px", "font-weight": "bold" }'
            data-client_id={env.neynarClientId}
            data-success-callback="_onSignInSuccess"
          />
        </CardContent>
      </Card>
    </div>
  );
}
