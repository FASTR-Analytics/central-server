import {
  AlertComponentProps,
  AlertFormHolder,
  Button,
  Checkbox,
  Csv,
  FrameTop,
  HeaderBarCanGoBack,
  HeadingBarMainRibbon,
  ModalContainer,
  SettingsSection,
  StateHolderWrapper,
  Table,
  TextArea,
  type TableColumn,
  downloadCsv,
  openComponent,
  timActionButton,
  timActionDelete,
  timActionForm,
  timQuery,
} from "panther";
import { For, Match, Show, Switch, createEffect, createSignal, on } from "solid-js";
import type {
  GlobalUser,
  InstanceUser,
  ProjectPermission,
  ProjectSummary,
  ProjectUserPermissions,
} from "lib";
import { PERMISSION_PRESETS, PROJECT_PERMISSIONS, PROJECT_PERMISSION_LABELS } from "lib";
import { t3 } from "platform-lib";
import { serverActions } from "~/server_actions";
import { instanceState } from "~/state/instance/t1_store";
import { BatchUploadUsersForm } from "./batch_upload_users_form";

type Props = {
  globalUser: GlobalUser;
};

export function InstanceUsers(p: Props) {
  const [selectedUser, setSelectedUser] = createSignal<InstanceUser | undefined>(undefined);

  const usersQuery = timQuery(
    () => serverActions.getUsers({}),
    "Loading users...",
  );

  const projectsQuery = timQuery(
    () => serverActions.getProjects({}),
    "Loading projects...",
  );

  createEffect(on(
    () => instanceState.usersLastUpdated,
    () => void usersQuery.silentFetch(),
    { defer: true },
  ));

  createEffect(on(
    () => instanceState.projectsLastUpdated,
    () => void projectsQuery.silentFetch(),
    { defer: true },
  ));

  async function openAddUsers() {
    await openComponent<{}, undefined>({
      element: _AddUsersForm,
      props: {},
    });
    // SSE (users_last_updated) refreshes the table
  }

  async function attemptBatchUploadUsers() {
    await openComponent({
      element: BatchUploadUsersForm,
      props: {},
    });
    // SSE (users_last_updated) refreshes the table
  }

  function downloadUsersCSV() {
    const s = usersQuery.state();
    if (s.status !== "ready") return;
    const csv = new Csv({
      colHeaders: ["email", "is_admin"],
      aoa: s.data.map((user) => [
        user.email,
        String(user.isAdmin),
      ]),
    });
    const today = new Date()
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "_");
    const filename = `users_export_${today}.csv`;
    downloadCsv(csv.stringify(), filename);
  }

  const columns: TableColumn<InstanceUser>[] = [
    {
      key: "firstName",
      header: "Name",
      sortable: true,
      render: (u) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
        return name
          ? <span class="text-sm">{name}</span>
          : <span class="text-base-content/50 text-sm">—</span>;
      },
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
    },
    {
      key: "isAdmin",
      header: "Status",
      sortable: true,
      render: (u) =>
        u.isAdmin
          ? <span class="text-primary text-sm">Instance administrator</span>
          : <span class="text-base-content/60 text-sm">User</span>,
    },
    {
      key: "actions" as keyof InstanceUser,
      header: "",
      alignH: "right" as const,
      render: (u) => (
        <Button
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            setSelectedUser(u);
          }}
          intent="base-100"
          iconName="pencil"
        />
      ),
    },
  ];

  return (
    <Switch>
      <Match when={selectedUser()} keyed>
        {(user) => (
          <_UserDetail
            user={user}
            globalUser={p.globalUser}
            projects={(() => {
              const s = projectsQuery.state();
              return s.status === "ready" ? s.data : [];
            })()}
            close={() => setSelectedUser(undefined)}
          />
        )}
      </Match>
      <Match when={true}>
        <FrameTop
          panelChildren={
            <HeadingBarMainRibbon heading="Users">
              <div class="ui-gap-sm flex items-center">
                <Button onClick={downloadUsersCSV} iconName="download">
                  {t3({
                    en: "Download users",
                    fr: "Télécharger les utilisateurs",
                  })}
                </Button>
                <Button
                  onClick={attemptBatchUploadUsers}
                  iconName="upload"
                >
                  {t3({
                    en: "Batch import from CSV",
                    fr: "Importation groupée depuis CSV",
                  })}
                </Button>
                <Button onClick={openAddUsers} iconName="plus">
                  Add users
                </Button>
              </div>
            </HeadingBarMainRibbon>
          }
        >
          <div class="ui-pad flex h-full w-full flex-col">
            <div class="min-h-0 flex-1">
              <StateHolderWrapper state={usersQuery.state()}>
                {(users: InstanceUser[]) => (
                  <Table
                    data={users}
                    columns={columns}
                    defaultSort={{ key: "email", direction: "asc" }}
                    keyField="email"
                    noRowsMessage="No users yet"
                    fitTableToAvailableHeight
                  />
                )}
              </StateHolderWrapper>
            </div>
          </div>
        </FrameTop>
      </Match>
    </Switch>
  );
}

// ─── User detail ─────────────────────────────────────────────────────────────

type UserDetailProps = {
  user: InstanceUser;
  globalUser: GlobalUser;
  projects: ProjectSummary[];
  close: () => void;
};

function _UserDetail(p: UserDetailProps) {
  const [isAdmin, setIsAdmin] = createSignal(p.user.isAdmin);
  const [canConfigureUsers, setCanConfigureUsers] = createSignal(p.user.canConfigureUsers);
  const [canCreateProjects, setCanCreateProjects] = createSignal(p.user.canCreateProjects);
  const [originalCanConfigureUsers, setOriginalCanConfigureUsers] = createSignal(p.user.canConfigureUsers);
  const [originalCanCreateProjects, setOriginalCanCreateProjects] = createSignal(p.user.canCreateProjects);

  const hasPermissionChanges = () =>
    canConfigureUsers() !== originalCanConfigureUsers() ||
    canCreateProjects() !== originalCanCreateProjects();

  const makeAdmin = timActionButton(
    () => serverActions.toggleUserAdmin({ email: p.user.email, isAdmin: true }),
    () => {
      setIsAdmin(true);
    },
  );

  const makeNonAdmin = timActionButton(
    () => serverActions.toggleUserAdmin({ email: p.user.email, isAdmin: false }),
    () => {
      setIsAdmin(false);
    },
  );

  const savePermissions = timActionButton(
    () =>
      serverActions.updateUserInstancePermissions({
        email: p.user.email,
        canConfigureUsers: canConfigureUsers(),
        canCreateProjects: canCreateProjects(),
      }),
    () => {
      setOriginalCanConfigureUsers(canConfigureUsers());
      setOriginalCanCreateProjects(canCreateProjects());
    },
  );

  async function openProjectPermissions(project: ProjectSummary) {
    await openComponent<{ email: string; projectId: string; projectLabel: string }, undefined>({
      element: _ProjectPermissionsModal,
      props: { email: p.user.email, projectId: project.id, projectLabel: project.label },
    });
  }

  async function deleteUser() {
    const action = timActionDelete(
      { text: `Are you sure you want to remove ${p.user.email}?`, itemList: [p.user.email] },
      () => serverActions.deleteUser({ email: p.user.email }),
      () => {
        p.close();
      },
    );
    await action.click();
  }

  return (
    <FrameTop
      panelChildren={
        <HeaderBarCanGoBack
          back={p.close}
          heading={`User profile for ${p.user.email}`}
        />
      }
    >
      <div class="ui-pad ui-spy">
        <SettingsSection header="Login details">
          <div class="flex">
            <div class="w-48 flex-none">Email:</div>
            <div class="flex-1">{p.user.email}</div>
          </div>
          <Show when={p.user.firstName || p.user.lastName}>
            <div class="flex">
              <div class="w-48 flex-none">Name:</div>
              <div class="flex-1">
                {[p.user.firstName, p.user.lastName].filter(Boolean).join(" ")}
              </div>
            </div>
          </Show>
        </SettingsSection>

        <Show when={p.user.email !== p.globalUser.email}>
          <SettingsSection
            header="Instance role"
            rightChildren={
              <div class="ui-gap-sm flex">
                <Switch>
                  <Match when={isAdmin()}>
                    <Button
                      onClick={makeNonAdmin.click}
                      state={makeNonAdmin.state()}
                      outline
                    >
                      Make non-admin
                    </Button>
                  </Match>
                  <Match when={true}>
                    <Button
                      onClick={makeAdmin.click}
                      state={makeAdmin.state()}
                      outline
                    >
                      Make admin
                    </Button>
                  </Match>
                </Switch>
              </div>
            }
          >
            <div class="flex">
              <div class="w-48 flex-none">Instance admin:</div>
              <div class="flex-1">{isAdmin() ? "Yes" : "No"}</div>
            </div>
          </SettingsSection>

          <Show when={!isAdmin()}>
            <SettingsSection
              header="Instance permissions"
              rightChildren={
                <Show when={hasPermissionChanges()}>
                  <Button
                    onClick={savePermissions.click}
                    state={savePermissions.state()}
                    intent="success"
                    iconName="save"
                  >
                    Save changes
                  </Button>
                </Show>
              }
            >
              <div class="space-y-2">
                <Checkbox
                  label="Can manage users"
                  checked={canConfigureUsers()}
                  onChange={() => setCanConfigureUsers((v) => !v)}
                />
                <Checkbox
                  label="Can create projects"
                  checked={canCreateProjects()}
                  onChange={() => setCanCreateProjects((v) => !v)}
                />
              </div>
            </SettingsSection>
          </Show>

          <Show when={!isAdmin() && p.projects.length > 0}>
            <SettingsSection header="Project permissions">
              <div class="grid grid-cols-3 gap-2">
                <For each={p.projects}>
                  {(project) => (
                    <button
                      type="button"
                      class="ui-pad ui-hoverable border-base-300 min-h-[60px] rounded border text-left text-sm font-semibold"
                      onClick={() => openProjectPermissions(project)}
                    >
                      {project.label}
                    </button>
                  )}
                </For>
              </div>
            </SettingsSection>
          </Show>

          <Button onClick={deleteUser} intent="danger" outline iconName="trash">
            Remove this user
          </Button>
        </Show>
      </div>
    </FrameTop>
  );
}

// ─── Add users modal ─────────────────────────────────────────────────────────

function _AddUsersForm(p: AlertComponentProps<{}, undefined>) {
  const [tempEmail, setTempEmail] = createSignal("");

  const goodEmailList = () =>
    tempEmail()
      .replaceAll(",", ":::")
      .replaceAll(";", ":::")
      .replaceAll("\n", ":::")
      .split(":::")
      .map((str) => str.trim())
      .filter(Boolean);

  const save = timActionForm(
    async (e: MouseEvent) => {
      e.preventDefault();
      const emails = goodEmailList().map((str) => str.toLowerCase());
      if (emails.length === 0) {
        return { success: false as const, err: "You must enter at least one email" };
      }
      return serverActions.addUsers({ emails });
    },
    async () => {},
    () => p.close(undefined),
  );

  return (
    <AlertFormHolder
      formId="add-users"
      header="Add new users"
      savingState={save.state()}
      saveFunc={save.click}
      cancelFunc={() => p.close(undefined)}
    >
      <TextArea
        label="Email addresses"
        value={tempEmail()}
        onChange={setTempEmail}
        fullWidth
        autoFocus
        height="150px"
      />
      <div class="text-xs">
        Add multiple emails, separated by a comma, semicolon, or line break.
      </div>
      <Show when={goodEmailList().length > 0}>
        <div>
          <For each={goodEmailList()}>
            {(email) => (
              <div class="list-item list-inside text-xs">{email}</div>
            )}
          </For>
        </div>
      </Show>
    </AlertFormHolder>
  );
}

// ─── Project permissions modal ───────────────────────────────────────────────

type ProjectPermissionsProps = {
  email: string;
  projectId: string;
  projectLabel: string;
};

function _ProjectPermissionsModal(p: AlertComponentProps<ProjectPermissionsProps, undefined>) {
  const [permissions, setPermissions] = createSignal<Record<ProjectPermission, boolean> | null>(null);
  const [originalPermissions, setOriginalPermissions] = createSignal<Record<ProjectPermission, boolean> | null>(null);

  (async () => {
    const res = await serverActions.getProjectUserPermissions({
      projectId: p.projectId,
      email: p.email,
    });
    const perms: Record<ProjectPermission, boolean> = res.success
      ? (res.data as ProjectUserPermissions)
      : (Object.fromEntries(PROJECT_PERMISSIONS.map((k) => [k, false])) as Record<ProjectPermission, boolean>);
    setPermissions(perms);
    setOriginalPermissions(perms);
  })();

  const hasChanges = (): boolean => {
    const current = permissions();
    const original = originalPermissions();
    if (!current || !original) return false;
    return (PROJECT_PERMISSIONS as readonly ProjectPermission[]).some(
      (key) => current[key] !== original[key],
    );
  };

  const togglePerm = (key: ProjectPermission) => {
    const current = permissions();
    if (!current) return;
    setPermissions({ ...current, [key]: !current[key] });
  };

  const save = timActionButton(
    async () => {
      const perms = permissions();
      if (!perms) return { success: false as const, err: "No permissions" };
      return serverActions.setProjectUserPermissions({
        projectId: p.projectId,
        email: p.email,
        permissions: perms,
      });
    },
    async () => {
      setOriginalPermissions(permissions());
    },
  );

  return (
    <ModalContainer
      width="lg"
      title={p.projectLabel}
      leftButtons={[
        <Show when={hasChanges()}>
          <Button onClick={save.click} state={save.state()} intent="success" iconName="save">
            Save
          </Button>
        </Show>,
        <Button onClick={() => p.close(undefined)} intent="neutral" iconName="x" outline>
          Cancel
        </Button>,
      ]}
    >
      <Show when={permissions()} keyed fallback={<div>Loading...</div>}>
        {(perms) => (
          <div class="ui-spy-sm">
            <div class="flex gap-2">
              <For each={PERMISSION_PRESETS}>
                {(preset) => (
                  <Button
                    onClick={() => setPermissions({ ...preset.permissions })}
                    intent="neutral"
                    size="sm"
                  >
                    {preset.label}
                  </Button>
                )}
              </For>
            </div>
            <div class="space-y-2">
              <For each={PROJECT_PERMISSIONS as readonly ProjectPermission[]}>
                {(key) => (
                  <Checkbox
                    label={PROJECT_PERMISSION_LABELS[key]}
                    checked={perms[key]}
                    onChange={() => togglePerm(key)}
                  />
                )}
              </For>
            </div>
          </div>
        )}
      </Show>
    </ModalContainer>
  );
}
