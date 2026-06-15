import {
  AlertComponentProps,
  AlertFormHolder,
  Button,
  HeadingBarMainRibbon,
  Input,
  LockIcon,
  openComponent,
  createFormAction,
} from "panther";
import { For, Show, createSignal } from "solid-js";
import type { ProjectSummary } from "lib";
import { serverActions } from "~/server_actions";

type Props = {
  projects: ProjectSummary[];
  canCreateProjects: boolean;
  onSelectProject: (id: string) => void;
};

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function _CreateProjectForm(p: AlertComponentProps<{}, { id: string }>) {
  const [label, setLabel] = createSignal("");

  const save = createFormAction(
    async () => {
      const trimmed = label().trim();
      if (!trimmed) return { success: false as const, err: "Enter a project name" };
      return serverActions.createProject({ label: trimmed });
    },
    async () => {},
    (data) => p.close(data!),
  );

  return (
    <AlertFormHolder
      formId="create-project"
      header="Create project"
      savingState={save.state()}
      saveFunc={save.click}
      cancelFunc={() => p.close(undefined)}
    >
      <div class="ui-spy">
        <Input
          label="Project name"
          value={label()}
          onChange={setLabel}
          fullWidth
          autoFocus
        />
      </div>
    </AlertFormHolder>
  );
}

export function ProjectsGrid(p: Props) {
  const visibleProjects = () => p.projects.filter((pr) => pr.status !== "pending_deletion");

  async function attemptCreateProject() {
    await openComponent<{}, { id: string }>({
      element: _CreateProjectForm,
      props: {},
    });
    // SSE (projects_last_updated) refreshes the projects list
  }

  return (
    <div class="flex h-full flex-col">
      <HeadingBarMainRibbon heading="Projects">
        <Show when={p.canCreateProjects}>
          <Button intent="primary" iconName="plus" onClick={attemptCreateProject}>
            Create project
          </Button>
        </Show>
      </HeadingBarMainRibbon>

      <div class="ui-pad ui-gap grid h-full w-full flex-1 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] content-start overflow-auto">
        <For
          each={visibleProjects()}
          fallback={
            <div class="text-base-content/40 text-sm">No projects yet</div>
          }
        >
          {(project) => (
            <button
              type="button"
              class="ui-pad ui-hoverable border-base-300 flex min-h-[150px] flex-col justify-between rounded border text-left"
              onClick={() => p.onSelectProject(project.id)}
            >
              <div class="ui-spy-sm">
                <div class="font-700">{project.label}</div>
                <Show when={project.isLocked}>
                  <div class="text-primary ui-gap-sm flex text-sm">
                    <span class="relative inline-flex h-[1.25em] w-[1.25em]">
                      <LockIcon />
                    </span>
                    Project locked
                  </div>
                </Show>
              </div>
              <div class="text-base-content/40 text-xs">
                {formatTimeAgo(project.createdAt)}
              </div>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
