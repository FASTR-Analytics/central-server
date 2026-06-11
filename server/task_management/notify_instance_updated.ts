import type { InstanceSseMessage } from "lib";

export const INSTANCE_UPDATES_CHANNEL = "instance_updates";

const broadcastInstanceUpdates = new BroadcastChannel(INSTANCE_UPDATES_CHANNEL);

export function notifyInstanceUpdate(message: InstanceSseMessage): void {
  broadcastInstanceUpdates.postMessage(message);
}

export function notifyInstanceProjectsLastUpdated(
  lastUpdated: string = new Date().toISOString(),
): void {
  notifyInstanceUpdate({
    type: "projects_last_updated",
    data: lastUpdated,
  });
}

export function notifyInstanceUsersLastUpdated(
  lastUpdated: string = new Date().toISOString(),
): void {
  notifyInstanceUpdate({
    type: "users_last_updated",
    data: lastUpdated,
  });
}
