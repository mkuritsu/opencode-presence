import type { Plugin } from "@opencode-ai/plugin";
import { Client } from "@xhayper/discord-rpc";
import { basename } from "node:path";

const CLIENT_ID = "1494188222874648697";
const RECONNECT_DELAY_MS = 5000;

const PRESENCE_DETAILS = {
  idle: "Cooking the next prompt",
  generating: "Clanker generating",
} as const;

type PresenceDetails = (typeof PRESENCE_DETAILS)[keyof typeof PRESENCE_DETAILS];

export const OpenCodePresencePlugin: Plugin = async ({ client, project, directory }) => {
  const rpc = new Client({ clientId: CLIENT_ID });
  const directoryName = basename(directory) || directory;
  const activityStartedAt = Date.now();

  let rpcReady = false;
  let connecting = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let details: PresenceDetails = PRESENCE_DETAILS.idle;

  const updateActivity = () => {
    if (!rpcReady) return;

    void rpc.user?.setActivity({
      details,
      state: `Vibing on ${directoryName}`,
      largeImageKey: "opencode-logo",
      largeImageText: "AI maxxing",
      emoji: { name: "opencodelogo" },
      startTimestamp: activityStartedAt,
    });
  };

  const setDetails = (next: PresenceDetails) => {
    if (details === next) return;
    details = next;
    updateActivity();
  };

  const setIdle = () => {
    setDetails(PRESENCE_DETAILS.idle);
  };

  const setGenerating = () => {
    setDetails(PRESENCE_DETAILS.generating);
  };

  const clearReconnectTimer = () => {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  };

  const connectRpc = async () => {
    if (connecting || rpcReady) return;

    connecting = true;
    try {
      await rpc.login();
    } catch {
      rpcReady = false;
      reconnectTimer ??= setTimeout(() => {
        reconnectTimer = undefined;
        void connectRpc();
      }, RECONNECT_DELAY_MS);
    } finally {
      connecting = false;
    }
  };

  rpc.on("ready", () => {
    rpcReady = true;
    clearReconnectTimer();
    updateActivity();
  });

  rpc.on("disconnected", () => {
    rpcReady = false;
    reconnectTimer ??= setTimeout(() => {
      reconnectTimer = undefined;
      void connectRpc();
    }, RECONNECT_DELAY_MS);
  });

  void connectRpc();

  return {
    event: async ({ event }) => {
      if (event.type === "session.status") {
        if (event.properties.status.type === "idle") {
          setIdle();
          return;
        }

        setGenerating();
        return;
      }

      if (event.type === "session.idle") {
        setIdle();
        return;
      }

      if (event.type === "message.updated" && event.properties.info.role === "assistant") {
        if (event.properties.info.time.completed) {
          setIdle();
          return;
        }

        setGenerating();
      }
    },
  };
};

export default OpenCodePresencePlugin;
