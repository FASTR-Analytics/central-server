import type { ProjectSseMessage } from "lib";
import { Button } from "panther";
import { type JSX, Show, createSignal, onCleanup, onMount } from "solid-js";
import { _SERVER_HOST } from "~/server_actions";
import {
  applyProjectSseMessage,
  projectState,
  resetProjectState,
} from "./t1_store";

const MAX_CONNECTION_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

let evtSource: EventSource | null = null;
let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
let connectionAttempts = 0;
let currentProjectId: string | null = null;

function getRetryDelay(attempt: number): number {
  return Math.min(BASE_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
}

export function connectProjectSSE(projectId: string): void {
  if (evtSource && evtSource.readyState !== EventSource.CLOSED) {
    if (currentProjectId === projectId) {
      return;
    }
    disconnectProjectSSE();
  }

  currentProjectId = projectId;
  connectionAttempts++;

  const url = `${_SERVER_HOST}/project_sse_v2/${projectId}`;
  console.log("Connecting to SSE v2:", url);

  evtSource = new EventSource(url, { withCredentials: true });

  evtSource.onopen = () => {
    connectionAttempts = 0;
  };

  evtSource.onmessage = (event) => {
    let msg: ProjectSseMessage;
    try {
      msg = JSON.parse(event.data) as ProjectSseMessage;
    } catch (error) {
      console.error("Failed to parse SSE message:", error, "Raw:", event.data);
      return;
    }

    applyProjectSseMessage(msg);
  };

  evtSource.onerror = () => {
    console.warn("EventSource error, readyState:", evtSource?.readyState);

    if (evtSource) {
      evtSource.close();
      evtSource = null;
    }

    if (connectionAttempts <= MAX_CONNECTION_ATTEMPTS && currentProjectId) {
      retryProjectSSE();
    }
  };
}

function retryProjectSSE(): void {
  if (connectionAttempts > MAX_CONNECTION_ATTEMPTS || !currentProjectId) {
    return;
  }

  const delay = getRetryDelay(connectionAttempts);
  console.log(`Retrying SSE v2 in ${delay}ms (attempt ${connectionAttempts})`);

  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
  }

  const projectId = currentProjectId;
  retryTimeoutId = setTimeout(() => connectProjectSSE(projectId), delay);
}

export function disconnectProjectSSE(): void {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  if (evtSource) {
    evtSource.close();
    evtSource = null;
  }

  currentProjectId = null;
  connectionAttempts = 0;
  resetProjectState();
}

export function getConnectionAttempts(): number {
  return connectionAttempts;
}

type ProjectSSEBoundaryProps = {
  projectId: string;
  children: JSX.Element;
};

export function ProjectSSEBoundary(props: ProjectSSEBoundaryProps) {
  const [connectAttempts, setConnectAttempts] = createSignal(0);

  onMount(() => {
    connectProjectSSE(props.projectId);
    const interval = setInterval(() => {
      setConnectAttempts(connectionAttempts);
    }, 100);
    onCleanup(() => clearInterval(interval));
  });

  onCleanup(() => {
    disconnectProjectSSE();
  });

  return (
    <Show
      when={connectAttempts() <= MAX_CONNECTION_ATTEMPTS}
      fallback={
        <div class="ui-pad ui-spy-sm">
          <div>Cannot connect to project.</div>
          <div>
            <Button href="/">Go home</Button>
          </div>
        </div>
      }
    >
      <Show
        when={projectState.isReady}
        fallback={
          <div class="ui-pad">
            Connecting to project
            {connectAttempts() > 1 ? ` (retrying ${connectAttempts() - 1})` : ""}
            ...
          </div>
        }
      >
        {props.children}
      </Show>
    </Show>
  );
}
