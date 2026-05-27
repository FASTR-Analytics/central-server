import { Button, FrameTop, HeadingBarMainRibbon, StateHolderWrapper, timQuery } from "panther";
import { Show, createSignal } from "solid-js";
import type { GlobalUser, ProjectSummary } from "lib";
import { serverActions } from "~/server_actions";
import { ProjectsGrid } from "./ProjectsGrid";
import { ProjectDetail } from "./ProjectDetail";
import { InstanceUsers } from "./InstanceUsers";

type Props = {
  globalUser: GlobalUser;
  attemptSignOut: () => Promise<void>;
};

export function CentralMain(p: Props) {
  const [selectedProjectId, setSelectedProjectId] = createSignal<string | null>(null);
  const [showUsers, setShowUsers] = createSignal(false);

  const projectsQuery = timQuery(
    () => serverActions.getProjects({}),
    "Loading projects...",
  );

  const selectedProject = (): ProjectSummary | undefined => {
    const s = projectsQuery.state();
    if (s.status !== "ready") return undefined;
    return s.data.find((pr) => pr.id === selectedProjectId());
  };

  return (
    <FrameTop
      panelChildren={
        <HeadingBarMainRibbon heading="FASTR Central Hub">
          <div class="flex items-center gap-3">
            <span class="text-base-100/60 text-sm">{p.globalUser.email}</span>
            <Show when={p.globalUser.canConfigureUsers}>
              <Button
                intent={showUsers() ? "primary" : "neutral"}
                iconName="users"
                size="sm"
                onClick={() => {
                  setShowUsers((v) => !v);
                  setSelectedProjectId(null);
                }}
              >
                Users
              </Button>
            </Show>
          </div>
        </HeadingBarMainRibbon>
      }
    >
      <Show
        when={showUsers()}
        fallback={
          <Show
            when={selectedProjectId()}
            fallback={
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
        }
      >
        <InstanceUsers globalUser={p.globalUser} />
      </Show>
    </FrameTop>
  );
}
