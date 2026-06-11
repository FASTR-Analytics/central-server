import type { ProjectSseMessage, ProjectState } from "lib";
import { _PROJECT_USER_PERMISSIONS_NO_ACCESS } from "lib";
import { createStore, reconcile } from "solid-js/store";

const EMPTY_PROJECT_STATE: ProjectState = {
  isReady: false,
  currentUserEmail: "",
  id: "",
  label: "",
  isLocked: false,
  importHistory: [],
  projectUsers: [],
  thisUserPermissions: structuredClone(_PROJECT_USER_PERMISSIONS_NO_ACCESS),
  metrics: [],
  visualizations: [],
  visualizationFolders: [],
  slideDecks: [],
  slideDeckFolders: [],
};

const [projectState, setProjectState] = createStore<ProjectState>(
  structuredClone(EMPTY_PROJECT_STATE),
);

export function applyProjectSseMessage(msg: ProjectSseMessage): void {
  switch (msg.type) {
    case "starting":
      setProjectState(reconcile(msg.data));
      break;

    case "project_config_updated":
      setProjectState("label", msg.data.label);
      setProjectState("isLocked", msg.data.isLocked);
      break;

    case "metrics_updated":
      setProjectState("metrics", reconcile(msg.data.metrics));
      break;

    case "visualizations_updated":
      setProjectState("visualizations", reconcile(msg.data.visualizations));
      break;

    case "visualization_folders_updated":
      setProjectState("visualizationFolders", reconcile(msg.data.visualizationFolders));
      break;

    case "slide_decks_updated":
      setProjectState("slideDecks", reconcile(msg.data.slideDecks));
      break;

    case "slide_deck_folders_updated":
      setProjectState("slideDeckFolders", reconcile(msg.data.slideDeckFolders));
      break;

    case "project_users_updated": {
      setProjectState("projectUsers", reconcile(msg.data.projectUsers, { key: "email" }));
      const currentUser = msg.data.projectUsers.find(
        (u) => u.email === projectState.currentUserEmail,
      );
      if (currentUser) {
        const { email: _email, firstName: _fn, lastName: _ln, isAdmin: _ia, ...permissions } = currentUser;
        setProjectState("thisUserPermissions", permissions);
      }
      break;
    }

    case "import_history_updated":
      setProjectState("importHistory", reconcile(msg.data.importHistory));
      break;

    case "error":
      console.error("SSE error:", msg.data.message);
      break;
  }
}

export function resetProjectState(): void {
  setProjectState(reconcile(structuredClone(EMPTY_PROJECT_STATE)));
}

export { projectState };
