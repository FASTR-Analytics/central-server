import { t3, TC } from "platform-lib";
import {
  Button,
  ModalContainer,
  SettingsSection,
  StateHolderWrapper,
  timQuery,
  type AlertComponentProps,
} from "panther";
import { serverActions } from "~/server_actions";

export function InstanceMetaForm(
  p: AlertComponentProps<{}, undefined>,
) {
  const instanceMeta = timQuery(
    () => serverActions.getInstanceMeta({}),
    t3({ en: "Loading instance information...", fr: "Chargement des informations de l'instance..." }),
  );

  function formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  }

  return (
    <ModalContainer
      title={t3({ en: "Instance Information", fr: "Informations de l'instance" })}
      width="lg"
      leftButtons={
        // eslint-disable-next-line jsx-key
        [
          <Button onClick={() => p.close(undefined)} iconName="x">
            {t3(TC.done)}
          </Button>,
        ]
      }
    >
      <StateHolderWrapper state={instanceMeta.state()}>
        {(keyedMeta) => {
          return (
            <>
              <div class="ui-gap flex text-sm">
                <div class="flex-1">
                  <SettingsSection header={t3({ en: "Instance Configuration", fr: "Configuration de l'instance" })}>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Instance Name", fr: "Nom de l'instance" })}:</div>
                      <div class="flex-1">{keyedMeta.instanceName}</div>
                    </div>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Instance ID", fr: "ID de l'instance" })}:</div>
                      <div class="flex-1">{keyedMeta.instanceId}</div>
                    </div>
                  </SettingsSection>
                </div>
                <div class="flex-1">
                  <SettingsSection header={t3({ en: "Version Information", fr: "Informations de version" })}>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Server Version", fr: "Version du serveur" })}:</div>
                      <div class="flex-1">{keyedMeta.serverVersion}</div>
                    </div>
                  </SettingsSection>
                </div>
              </div>

              <div class="ui-gap flex text-sm">
                <div class="flex-1">
                  <SettingsSection header={t3({ en: "System Status", fr: "État du système" })}>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Environment", fr: "Environnement" })}:</div>
                      <div class="flex-1">{keyedMeta.environment}</div>
                    </div>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Database Folder", fr: "Dossier de base de données" })}:</div>
                      <div class="flex-1">{keyedMeta.databaseFolder}</div>
                    </div>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Health Status", fr: "État de santé" })}:</div>
                      <div class="flex-1">
                        <span class={keyedMeta.isHealthy ? "text-success" : "text-danger"}>
                          {keyedMeta.isHealthy ? t3({ en: "Healthy", fr: "Opérationnel" }) : t3({ en: "Unhealthy", fr: "Non opérationnel" })}
                        </span>
                      </div>
                    </div>
                  </SettingsSection>
                </div>
                <div class="flex-1">
                  <SettingsSection header={t3({ en: "Runtime Information", fr: "Informations d'exécution" })}>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Start Time", fr: "Heure de démarrage" })}:</div>
                      <div class="flex-1">{new Date(keyedMeta.startTime).toLocaleString()}</div>
                    </div>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Current Time", fr: "Heure actuelle" })}:</div>
                      <div class="flex-1">{new Date(keyedMeta.currentTime).toLocaleString()}</div>
                    </div>
                    <div class="flex">
                      <div class="w-36 flex-none">{t3({ en: "Uptime", fr: "Temps de fonctionnement" })}:</div>
                      <div class="flex-1">{formatUptime(keyedMeta.uptimeMs)}</div>
                    </div>
                  </SettingsSection>
                </div>
              </div>
            </>
          );
        }}
      </StateHolderWrapper>
    </ModalContainer>
  );
}
