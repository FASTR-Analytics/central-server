import { clerk } from "~/components/LoggedInWrapper";
import { t3, TC } from "platform-lib";
import {
  Button,
  TextArea,
  ModalContainer,
  SettingsSection,
  StateHolderWrapper,
  createButtonAction,
  createQuery,
  type AlertComponentProps,
} from "panther";
import { serverActions } from "~/server_actions";
import { createSignal, Show } from "solid-js";

export function ProfileForm(
  p: AlertComponentProps<
    {
      attemptSignOut: () => Promise<void>;
    },
    undefined
  >,
) {
  const userDetails = createQuery(
    () => serverActions.getGlobalUser({}),
    t3({ en: "Loading your profile...", fr: "Chargement de votre profil..." }),
  );

  return (
    <ModalContainer
      title={t3({ en: "Your profile", fr: "Votre profil" })}
      width="lg"
      leftButtons={
        // eslint-disable-next-line jsx-key
        [
          <Button onClick={() => p.close(undefined)} iconName="x">
            {t3(TC.done)}
          </Button>,
          <Button onClick={p.attemptSignOut} outline iconName="arrowLeft">
            {t3({ en: "Sign out", fr: "Se déconnecter" })}
          </Button>,
        ]
      }
    >
      <StateHolderWrapper state={userDetails.state()} noPad>
        {(keyedUser) => {
          const [organisation, setOrganisation] = createSignal(
            (clerk.user?.unsafeMetadata?.organisation as string | undefined) ?? "",
          );

          const [editingOrganisation, setEditingOrganisation] = createSignal(false);

          const saveOrganisation = createButtonAction(async () => {
            await clerk.user?.update({
              unsafeMetadata: {
                ...clerk.user.unsafeMetadata,
                organisation: organisation(),
              },
            });
            setEditingOrganisation(false);
            return { success: true };
          });

          return (
            <>
              {/* Hero */}
              <div class="border-base-300 flex flex-col items-center gap-3 border-b pt-2 pb-6">
                {clerk.user?.imageUrl && (
                  <button
                    type="button"
                    class="hover:ring-primary cursor-pointer rounded-full ring-2 ring-transparent transition"
                    onClick={() => clerk.openUserProfile()}
                    title={t3({ en: "Manage account", fr: "Gérer le compte" })}
                  >
                    <img
                      src={clerk.user.imageUrl}
                      alt={keyedUser.firstName ?? ""}
                      class="h-20 w-20 rounded-full"
                    />
                  </button>
                )}
                <div class="flex flex-col items-center gap-1">
                  <div class="font-700 text-base-content text-base">
                    {[keyedUser.firstName, keyedUser.lastName]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </div>
                  <div class="text-neutral text-sm">{keyedUser.email}</div>
                  <button
                    type="button"
                    class="text-primary mt-1 cursor-pointer text-xs hover:underline"
                    onClick={() => clerk.openUserProfile()}
                  >
                    {t3({ en: "Manage account", fr: "Gérer le compte" })}
                  </button>
                </div>
              </div>

              {/* Organisation */}
              <SettingsSection
                header={t3({ en: "Organisation", fr: "Organisation" })}
              >
                <Show
                  when={editingOrganisation()}
                  fallback={
                    <div class="flex items-center gap-2">
                      <span class="text-base-content/80 text-sm flex-1">
                        {organisation() || <span class="text-base-content/40">{t3({ en: "Not set", fr: "Non défini" })}</span>}
                      </span>
                      <Button onClick={() => setEditingOrganisation(true)} outline size="sm" iconName="pencil">
                        {t3({ en: "Edit", fr: "Modifier" })}
                      </Button>
                    </div>
                  }
                >
                  <div class="flex items-center gap-2">
                    <TextArea
                      value={organisation()}
                      onChange={setOrganisation}
                      placeholder={t3({ en: "Organisation name", fr: "Nom de l'organisation" })}
                      fullWidth
                      rows={1}
                      size="sm"
                      autoFocus
                    />
                    <Button
                      onClick={saveOrganisation.click}
                      state={saveOrganisation.state()}
                      intent="primary"
                      outline
                    >
                      {t3({ en: "Save", fr: "Enregistrer" })}
                    </Button>
                    <Button onClick={() => setEditingOrganisation(false)} intent="neutral" outline>
                      {t3({ en: "Cancel", fr: "Annuler" })}
                    </Button>
                  </div>
                </Show>
              </SettingsSection>
            </>
          );
        }}
      </StateHolderWrapper>
    </ModalContainer>
  );
}
