import { ButtonGroup, FrameTop, StateHolderWrapper, timQuery } from "panther";
import { Match, Show, Switch, createSignal } from "solid-js";
import type { GlobalUser, ProjectSummary } from "lib";
import { serverActions } from "~/server_actions";
import { ProjectsGrid } from "./ProjectsGrid";
import { ProjectDetail } from "./ProjectDetail";
import { InstanceUsers } from "./InstanceUsers";

type Tab = "projects" | "users";

type Props = {
  globalUser: GlobalUser;
  attemptSignOut: () => Promise<void>;
};

export function CentralMain(p: Props) {
  const [selectedProjectId, setSelectedProjectId] = createSignal<string | null>(null);
  const [tab, setTab] = createSignal<Tab>("projects");

  const tabOptions = () => [
    { value: "projects" as Tab, label: "Projects", iconName: "folder" as const },
    ...(p.globalUser.canConfigureUsers
      ? [{ value: "users" as Tab, label: "Users", iconName: "users" as const }]
      : []),
  ];

  const projectsQuery = timQuery(
    () => serverActions.getProjects({}),
    "Loading projects...",
  );

  const selectedProject = (): ProjectSummary | undefined => {
    const s = projectsQuery.state();
    if (s.status !== "ready") return undefined;
    return s.data.find((pr) => pr.id === selectedProjectId());
  };

  function handleTabChange(t: Tab | undefined) {
    if (!t) return;
    setTab(t);
    setSelectedProjectId(null);
  }

  // When a project is selected, ProjectDetail takes over the full screen with its own FrameTop
  return (
    <Show
      when={selectedProjectId()}
      fallback={
        <FrameTop
          panelChildren={
            <div class="ui-pad ui-gap bg-base-100 text-base-content flex items-center border-b border-base-300">
              <div class="flex-none border-r border-base-300 pr-4">
                <span class="font-700 text-xl">FASTR Central Hub</span>
              </div>
              <div class="flex flex-1 justify-center">
                <Show when={p.globalUser.approved}>
                  <ButtonGroup
                    value={tab()}
                    onChange={handleTabChange}
                    options={tabOptions()}
                    itemWidth="115px"
                  />
                </Show>
              </div>
              <div class="flex flex-none items-center">
                <span class="text-base-content/50 text-sm">{p.globalUser.email}</span>
              </div>
            </div>
          }
        >
          <Show
            when={p.globalUser.approved}
            fallback={
              <div class="ui-pad ui-spy">
                <p>You are not yet approved. Wait for an administrator to add you to the platform.</p>
                <button
                  type="button"
                  class="text-base-content/50 text-sm underline"
                  onClick={p.attemptSignOut}
                >
                  Sign out
                </button>
              </div>
            }
          >
            <Switch>
              <Match when={tab() === "users" && p.globalUser.canConfigureUsers}>
                <InstanceUsers globalUser={p.globalUser} />
              </Match>
              <Match when={true}>
                <StateHolderWrapper state={projectsQuery.state()}>
                  {(projects: ProjectSummary[]) => (
                    <ProjectsGrid
                      projects={projects}
                      canCreateProjects={p.globalUser.canCreateProjects}
                      onSelectProject={setSelectedProjectId}
                      onProjectCreated={projectsQuery.silentFetch}
                    />
                  )}
                </StateHolderWrapper>
              </Match>
            </Switch>
          </Show>
        </FrameTop>
      }
    >
      <ProjectDetail
        projectId={selectedProjectId()!}
        project={selectedProject()}
        globalUser={p.globalUser}
        onProjectUpdated={projectsQuery.silentFetch}
        onBack={() => setSelectedProjectId(null)}
      />
    </Show>
  );
}
