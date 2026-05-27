import {
  Button,
  HeadingBar,
  StateHolderWrapper,
  Table,
  type TableColumn,
  openConfirm,
  timActionButton,
  timQuery,
} from "panther";
import { createMemo, createSignal, Show } from "solid-js";
import type { GlobalUser, InstanceUser } from "lib";
import { serverActions } from "~/server_actions";

type Props = {
  globalUser: GlobalUser;
};

export function InstanceUsers(p: Props) {
  const [addEmail, setAddEmail] = createSignal("");

  const usersQuery = timQuery(
    () => serverActions.getUsers({}),
    "Loading users...",
  );

  const columns = createMemo((): TableColumn<InstanceUser>[] => [
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (u) => (
        <div class="flex flex-col">
          <span class="text-sm">{u.email}</span>
          <Show when={u.firstName || u.lastName}>
            <span class="text-base-content/50 text-xs">
              {[u.firstName, u.lastName].filter(Boolean).join(" ")}
            </span>
          </Show>
        </div>
      ),
    },
    {
      key: "isAdmin",
      header: "Role",
      sortable: true,
      render: (u) =>
        u.isAdmin ? (
          <span class="text-primary text-sm font-600">Admin</span>
        ) : (
          <span class="text-base-content/60 text-sm">User</span>
        ),
    },
    {
      key: "actions" as keyof InstanceUser,
      header: "",
      alignH: "right" as const,
      render: (u) => (
        <Show when={u.email !== p.globalUser.email}>
          <div class="flex gap-1">
            <Button
              iconName={u.isAdmin ? "user" : "badge"}
              size="sm"
              intent="base-100"
              onClick={async (e: MouseEvent) => {
                e.stopPropagation();
                await serverActions.toggleUserAdmin({ email: u.email, isAdmin: !u.isAdmin });
                await usersQuery.silentFetch();
              }}
            >
              {u.isAdmin ? "Remove admin" : "Make admin"}
            </Button>
            <Button
              iconName="trash"
              size="sm"
              intent="danger"
              outline
              onClick={async (e: MouseEvent) => {
                e.stopPropagation();
                const confirmed = await openConfirm({ text: `Remove ${u.email}?` });
                if (!confirmed) return;
                await serverActions.deleteUser({ email: u.email });
                await usersQuery.silentFetch();
              }}
            />
          </div>
        </Show>
      ),
    },
  ]);

  const addAction = timActionButton(
    async () => {
      const email = addEmail().trim().toLowerCase();
      if (!email) return { success: false as const, err: "Enter an email" };
      return serverActions.addUsers({ emails: [email] });
    },
    async () => {
      setAddEmail("");
      await usersQuery.silentFetch();
    },
  );

  return (
    <div class="flex h-full w-full flex-col">
      <HeadingBar heading="Users" ensureHeightAsIfButton />
      <div class="ui-pad flex flex-1 flex-col gap-4 overflow-auto">
        <div class="flex items-end gap-2">
          <div class="flex flex-col gap-1">
            <label class="text-base-content/60 text-xs">Add user by email</label>
            <input
              type="email"
              class="border-base-300 rounded border px-3 py-1.5 text-sm"
              placeholder="user@example.com"
              value={addEmail()}
              onInput={(e) => setAddEmail(e.currentTarget.value)}
            />
          </div>
          <Button
            intent="primary"
            iconName="plus"
            size="sm"
            state={addAction.state()}
            onClick={addAction.click}
          >
            Add user
          </Button>
        </div>
        <StateHolderWrapper state={usersQuery.state()}>
          {(users: InstanceUser[]) => (
            <Table
              data={users}
              columns={columns()}
              keyField="email"
              noRowsMessage="No users yet"
            />
          )}
        </StateHolderWrapper>
      </div>
    </div>
  );
}
