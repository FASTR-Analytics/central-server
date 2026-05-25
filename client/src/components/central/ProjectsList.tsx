import { Button, Input, LockIcon, timActionForm } from "panther";
import { For, Show, createSignal } from "solid-js";
import type { ProjectSummary } from "lib";
import { serverActions } from "~/server_actions";

type Props = {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  isHUser: boolean;
  onProjectCreated: () => Promise<void>;
};

export function ProjectsList(p: Props) {
  const visibleProjects = () =>
    p.projects.filter((pr) => pr.status !== "pending_deletion");

  const createAction = timActionForm(
    (label: string) => serverActions.createProject({ label }),
    (_data) => p.onProjectCreated(),
  );

  return (
    <div class="ui-spy border-base-300 flex h-full w-64 flex-none flex-col border-r">
      <div class="ui-pad border-base-300 flex items-center gap-2 border-b">
        <span class="font-700 flex-1 text-sm uppercase tracking-wider">Projects</span>
        <Show when={p.isHUser}>
          <_AddProjectInline onCreate={(label) => createAction.click(label)} />
        </Show>
      </div>

      <div class="ui-spy-sm flex flex-1 flex-col overflow-y-auto">
        <Show when={visibleProjects().length === 0}>
          <div class="text-base-content/40 ui-pad text-sm">No projects yet</div>
        </Show>
        <For each={visibleProjects()}>
          {(project) => (
            <button
              type="button"
              class="ui-pad-x ui-pad-y-sm flex items-center gap-2 text-left transition-colors hover:bg-base-200"
              classList={{ "bg-base-200 font-700": p.selectedProjectId === project.id }}
              onClick={() => p.onSelectProject(project.id)}
            >
              <span class="flex-1 truncate text-sm">{project.label}</span>
              <Show when={project.isLocked}>
                <LockIcon class="text-base-content/40 h-3 w-3 flex-none" />
              </Show>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

type AddProjectProps = {
  onCreate: (label: string) => void;
};

function _AddProjectInline(p: AddProjectProps) {
  const [label, setLabel] = createSignal("");
  const [open, setOpen] = createSignal(false);

  function submit() {
    const l = label().trim();
    if (!l) return;
    p.onCreate(l);
    setLabel("");
    setOpen(false);
  }

  return (
    <Show
      when={open()}
      fallback={
        <Button size="sm" iconName="plus" onClick={() => setOpen(true)} ariaLabel="Add project" />
      }
    >
      <form
        class="flex items-center gap-1"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <Input
          value={label()}
          onChange={setLabel}
          label="Project name"
          autoFocus
        />
        <Button size="sm" iconName="check" intent="primary" type="submit" ariaLabel="Create" />
        <Button size="sm" iconName="x" onClick={() => setOpen(false)} ariaLabel="Cancel" />
      </form>
    </Show>
  );
}
