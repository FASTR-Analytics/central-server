import { Clerk } from "@clerk/clerk-js";
import { StateHolderWrapper, timQuery } from "panther";
import { JSX, Show, createSignal, onMount } from "solid-js";
import { serverActions } from "~/server_actions";
import type { GlobalUser } from "lib";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const bypassAuth =
  import.meta.env.VITE_BYPASS_AUTH === "true" &&
  import.meta.env.MODE !== "production";

export const clerk = new Clerk(publishableKey);

type Props = {
  children: (globalUser: GlobalUser, attemptSignOut: () => Promise<void>) => JSX.Element;
};

export function LoggedInWrapper(p: Props) {
  const [clerkLoaded, setClerkLoaded] = createSignal(bypassAuth);
  const [clerkUser, setClerkUser] = createSignal(clerk.user);

  const globalUserQuery = timQuery(
    () => serverActions.getGlobalUser({}),
    "Loading...",
  );

  onMount(async () => {
    if (!bypassAuth) {
      await clerk.load({ appearance: { variables: { colorPrimary: "#0E706C" } } });
      setClerkLoaded(true);
      setClerkUser(clerk.user);

      clerk.addListener(({ user }) => {
        const wasSignedIn = !!clerkUser();
        setClerkUser(user);
        if (user && !wasSignedIn) {
          globalUserQuery.fetch();
        }
      });

      if (clerk.user) {
        globalUserQuery.fetch();
      }
    } else {
      globalUserQuery.fetch();
    }
  });

  async function attemptSignOut() {
    await clerk.signOut();
    setClerkUser(null);
  }

  return (
    <Show
      when={clerkLoaded()}
      fallback={<div class="flex h-full items-center justify-center text-base-content/50">Loading...</div>}
    >
      <Show
        when={bypassAuth || clerkUser()}
        fallback={
          <div class="flex h-full flex-col items-center justify-center gap-4">
            <div class="text-lg font-700">FASTR Central Hub</div>
            <button
              type="button"
              class="bg-primary text-primary-content rounded px-6 py-2 font-700"
              onClick={() => clerk.openSignIn({})}
            >
              Sign in
            </button>
          </div>
        }
      >
        <StateHolderWrapper state={globalUserQuery.state()}>
          {(globalUser) => p.children(globalUser, attemptSignOut)}
        </StateHolderWrapper>
      </Show>
    </Show>
  );
}
