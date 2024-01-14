import { ClientOnly } from "remix-utils/client-only";
import { AuthKitProvider, SignInButton, StatusAPIResponse } from "@farcaster/auth-kit";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { getSharedEnv } from "~/lib/utils.server";
import { useCallback, useState } from "react";
import { authenticator } from "~/lib/auth.server";
import { User } from "@prisma/client";
import { ArrowRight, Loader2 } from "lucide-react";
import invariant from "tiny-invariant";
import "@farcaster/auth-kit/styles.css";
import { Farcaster } from "~/components/icons/farcaster";

// export meta
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: "anon" },
    {
      property: "og:title",
      content: "anon",
    },
    {
      name: "description",
      content: "team based trolling on farcaster",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  const env = getSharedEnv();

  return typedjson({
    env,
    user,
  });
}

export default function Home() {
  const { env, user } = useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);
  const [signInComplete, setSignInComplete] = useState(false);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center min-h-screen">
      <div className="max-w-xl flex flex-col justify-center items-center gap-8">
        <div className="flex flex-col items-center">
          <Link to="/~" className="no-underline">
            <h1 className="text-6xl logo opacity-80">ghost</h1>
          </Link>
          <h2 className="font-normal mb-8 opacity-70 ">Team based trolling on farcaster</h2>
        </div>
      </div>

      <hr />

      <LoginButton user={user} env={env} />
    </div>
  );
}

function LoginButton(props: { user: User | null; env: ReturnType<typeof getSharedEnv> }) {
  const { user, env } = props;
  const [loggingIn, setLoggingIn] = useState(false);
  const navigate = useNavigate();

  const farcasterConfig = {
    rpcUrl: `https://optimism-mainnet.infura.io/v3/${env.infuraProjectId}`,
    domain: new URL(env.hostUrl).host.split(":")[0],
    siweUri: `${env.hostUrl}/login`,
  };

  const handleSuccess = useCallback((res: StatusAPIResponse) => {
    setLoggingIn(true);
    invariant(res.message, "message is required");
    invariant(res.signature, "signature is required");
    invariant(res.nonce, "nonce is required");

    const params = new URLSearchParams();
    params.append("message", res.message);
    params.append("signature", res.signature);
    params.append("nonce", res.nonce);
    res.username && params.append("username", res.username);
    res.pfpUrl && params.append("pfpUrl", res.pfpUrl);

    navigate(`/auth/farcaster?${params}`, {
      replace: true,
    });
  }, []);

  if (user) {
    return (
      <Button
        className="relative w-full min-w-[250px] sm:w-[250px] text-white/80 hover:text-white/100 border-black active:translate-y-[2px] bg-slate-800/80 hover:bg-slate-800 transition-all duration-100"
        variant={"outline"}
      >
        <span>Go to App</span>
        <ArrowRight className="mr-2 h-5 w-5" />
      </Button>
    );
  }

  return (
    <AuthKitProvider config={farcasterConfig}>
      <ClientOnly>
        {() => {
          return (
            <AuthKitProvider config={farcasterConfig}>
              <Button
                className="relative w-full min-w-[250px] sm:w-[250px] text-white/80 hover:text-white/100 border-black active:translate-y-[2px] bg-slate-800/80 hover:bg-slate-800 transition-all duration-100"
                variant={"outline"}
              >
                {loggingIn ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <>
                    <Farcaster className="mr-2 h-5 w-5" />
                    <span>Login with Farcaster</span>
                    <div id="fc-btn-wrap" className="absolute w-full sm:w-[250px]">
                      <SignInButton onSuccess={handleSuccess} />
                    </div>
                  </>
                )}
              </Button>
            </AuthKitProvider>
          );
        }}
      </ClientOnly>
    </AuthKitProvider>
  );
}
