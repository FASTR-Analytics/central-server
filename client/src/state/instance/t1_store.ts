import type { InstanceState } from "lib";
import { createStore, reconcile } from "solid-js/store";

const EMPTY_INSTANCE_STATE: InstanceState = {
  isReady: false,
  currentUserEmail: "",
  projectsLastUpdated: "",
  usersLastUpdated: "",
};

const [instanceState, setInstanceState] = createStore<InstanceState>(
  structuredClone(EMPTY_INSTANCE_STATE),
);

export function initInstanceState(data: InstanceState): void {
  setInstanceState(reconcile(data));
}

export function updateProjectsLastUpdated(lastUpdated: string): void {
  setInstanceState("projectsLastUpdated", lastUpdated);
}

export function updateUsersLastUpdated(lastUpdated: string): void {
  setInstanceState("usersLastUpdated", lastUpdated);
}

export function resetInstanceState(): void {
  setInstanceState(reconcile(structuredClone(EMPTY_INSTANCE_STATE)));
}

export { instanceState };
