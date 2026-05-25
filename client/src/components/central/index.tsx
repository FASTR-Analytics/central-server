import { Button, FrameLeft, FrameTop, HeadingBarMainRibbon, StateHolderWrapper, timQuery } from "panther";
import { createSignal, Show } from "solid-js";
import type { GlobalUser, ProjectSummary } from "lib";
import { serverActions } from "~/server_actions";
import { ProjectsList } from "./ProjectsList";
import { ProjectDetail } from "./ProjectDetail";

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
            <Button intent="base-100" onClick={p.attemptSignOut}>Sign out</Button>
          </div>
        </HeadingBarMainRibbon>
      }
    >
      <FrameLeft
        panelChildren={
          <StateHolderWrapper state={projectsQuery.state()}>
            {(projects) => (
              <ProjectsList
                projects={projects}
                selectedProjectId={selectedProjectId()}
                onSelectProject={setSelectedProjectId}
                isHUser={p.globalUser.isHUser}
                onProjectCreated={projectsQuery.silentFetch}
              />
            )}
          </StateHolderWrapper>
        }
      >
        <Show
          when={selectedProjectId()}
          fallback={
            <div class="flex h-full items-center justify-center text-base-content/40">
              Select a project
            </div>
          }
        >
          <ProjectDetail
            projectId={selectedProjectId()!}
            project={selectedProject()}
            onProjectUpdated={projectsQuery.silentFetch}
            isHUser={p.globalUser.isHUser}
          />
        </Show>
      </FrameLeft>
    </FrameTop>
  );
}
