import type { InstanceSseMessage } from "lib";
import { Button } from "panther";
import { type JSX, Show, createSignal, onCleanup, onMount } from "solid-js";
import { _SERVER_HOST } from "~/server_actions";
import {
  initInstanceState,
  instanceState,
  resetInstanceState,
  updateProjectsLastUpdated,
  updateUsersLastUpdated,
} from "./t1_store";

const MAX_CONNECTION_ATTEMPTS = 5;
const BASE_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

let evtSource: EventSource | null = null;
let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
let connectionAttempts = 0;

const [connectionFailed, setConnectionFailed] = createSignal(false);

function getRetryDelay(attempt: number): number {
  return Math.min(BASE_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
}

export function connectInstanceSSE(): void {
  if (evtSource && evtSource.readyState !== EventSource.CLOSED) {
    return;
  }

  connectionAttempts++;

  const url = `${_SERVER_HOST}/instance_updates`;
  console.log("Connecting to instance SSE:", url);

  evtSource = new EventSource(url, { withCredentials: true });

  evtSource.onopen = () => {
    connectionAttempts = 0;
    setConnectionFailed(false);
  };

  evtSource.onmessage = (event) => {
    let msg: InstanceSseMessage;
    try {
      msg = JSON.parse(event.data) as InstanceSseMessage;
    } catch (error) {
      console.error("Failed to parse SSE message:", error, "Raw:", event.data);
      return;
    }

    switch (msg.type) {
      case "starting":
        initInstanceState(msg.data);
        break;
      case "projects_last_updated":
        updateProjectsLastUpdated(msg.data);
        break;
      case "users_last_updated":
        updateUsersLastUpdated(msg.data);
        break;
      case "error":
        console.error("SSE error:", msg.data.message);
        break;
    }
  };

  evtSource.onerror = () => {
    console.warn("Instance EventSource error, readyState:", evtSource?.readyState);

    if (evtSource) {
      evtSource.close();
      evtSource = null;
    }

    if (connectionAttempts <= MAX_CONNECTION_ATTEMPTS) {
      retryInstanceSSE();
    } else {
      setConnectionFailed(true);
    }
  };
}

function retryInstanceSSE(): void {
  if (connectionAttempts > MAX_CONNECTION_ATTEMPTS) {
    setConnectionFailed(true);
    return;
  }

  const delay = getRetryDelay(connectionAttempts);
  console.log(`Retrying instance SSE in ${delay}ms (attempt ${connectionAttempts})`);

  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
  }

  retryTimeoutId = setTimeout(() => connectInstanceSSE(), delay);
}

export function disconnectInstanceSSE(): void {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  if (evtSource) {
    evtSource.close();
    evtSource = null;
  }

  connectionAttempts = 0;
  setConnectionFailed(false);
  resetInstanceState();
}

type InstanceSSEBoundaryProps = {
  children: JSX.Element;
};

export function InstanceSSEBoundary(props: InstanceSSEBoundaryProps) {
  onMount(() => {
    connectInstanceSSE();
  });

  onCleanup(() => {
    disconnectInstanceSSE();
  });

  return (
    <Show
      when={!connectionFailed()}
      fallback={
        <div class="ui-pad ui-spy-sm">
          <div>Cannot connect to server.</div>
          <div>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      }
    >
      <Show
        when={instanceState.isReady}
        fallback={<div class="ui-pad">Connecting...</div>}
      >
        {props.children}
      </Show>
    </Show>
  );
}
