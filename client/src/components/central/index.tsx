import { FrameTop, HeadingBarMainRibbon, StateHolderWrapper, timQuery } from "panther";
import { Show } from "solid-js";
import type { GlobalUser, ProjectSummary } from "lib";
import { serverActions } from "~/server_actions";
import { ProjectsGrid } from "./ProjectsGrid";
import { ProjectDetail } from "./ProjectDetail";
import { createSignal } from "solid-js";

type Props = {
  globalUser: GlobalUser;
  attemptSignOut: () => Promise<void>;
};

export function CentralMain(p: Props) {
  const [selectedProjectId, setSelectedProjectId] = createSignal<string | null>(null);

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
          </div>
        </HeadingBarMainRibbon>
      }
    >
      <Show
        when={selectedProjectId()}
        fallback={
          <StateHolderWrapper state={projectsQuery.state()}>
            {(projects: ProjectSummary[]) => (
              <ProjectsGrid
                projects={projects}
                isHUser={p.globalUser.isHUser}
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
          onProjectUpdated={projectsQuery.silentFetch}
          isHUser={p.globalUser.isHUser}
          onBack={() => setSelectedProjectId(null)}
        />
      </Show>
    </FrameTop>
  );
}
