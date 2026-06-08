import {
  AlertFormHolder,
  Button,
  HeadingBar,
  Input,
  openComponent,
  PageHolder,
  StateHolderWrapper,
  timActionForm,
  timQuery,
  getQueryStateFromApiResponse,
  type AlertComponentProps,
  type PageInputs,
  type StateHolder,
} from "panther";
import {
  PAGE_HEIGHT_DU,
  PAGE_WIDTH_DU,
  type SlideDeckConfig,
  type SlideDeckSummary,
  getStartingConfigForSlideDeck,
} from "platform-lib";
import { createEffect, createSignal, For, Show } from "solid-js";
import { convertSlideToPageInputs } from "~/generate_slide_deck/convert_slide_to_page_inputs";
import { serverActions } from "~/server_actions";

type Props = {
  projectId: string;
  canConfigure: boolean;
  onOpenEditor: (id: string) => void;
};

export function SlideDecksList(p: Props) {
  const listQuery = timQuery(
    () => serverActions.listSlideDecks({ projectId: p.projectId }),
    "Loading slide decks...",
  );

  async function handleNew() {
    const result = await openComponent<{ projectId: string }, { newDeckId: string }>({
      element: _AddDeckForm,
      props: { projectId: p.projectId },
    });
    if (result) {
      listQuery.fetch();
      p.onOpenEditor(result.newDeckId);
    }
  }

  return (
    <div class="flex h-full w-full min-w-0 flex-col">
      <HeadingBar heading="Slide Decks" ensureHeightAsIfButton>
        <Show when={p.canConfigure}>
          <Button intent="primary" iconName="plus" size="sm" onClick={handleNew}>
            New slide deck
          </Button>
        </Show>
      </HeadingBar>
      <div class="ui-pad flex flex-1 flex-col gap-4 overflow-auto">
        <StateHolderWrapper state={listQuery.state()}>
          {(items: SlideDeckSummary[]) => (
            <Show
              when={items.length > 0}
              fallback={
                <div class="text-base-content/40 text-sm">No slide decks yet</div>
              }
            >
              <div class="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
                <For each={items}>
                  {(deck) => (
                    <_DeckCard
                      projectId={p.projectId}
                      deck={deck}
                      onOpenEditor={() => p.onOpenEditor(deck.id)}
                    />
                  )}
                </For>
              </div>
            </Show>
          )}
        </StateHolderWrapper>
      </div>
    </div>
  );
}

const _defaultConfig = getStartingConfigForSlideDeck("");

function _DeckCard(p: {
  projectId: string;
  deck: SlideDeckSummary;
  onOpenEditor: () => void;
}) {
  const [pageInputs, setPageInputs] = createSignal<StateHolder<PageInputs>>({
    status: "loading",
    msg: "Loading...",
  });

  createEffect(async () => {
    const slideId = p.deck.firstSlideId;
    const config: SlideDeckConfig = p.deck.config ?? _defaultConfig;

    if (!slideId) {
      setPageInputs({ status: "error", err: "No slides" });
      return;
    }

    setPageInputs({ status: "loading", msg: "Loading..." });
    const res = await serverActions.getSlide({ projectId: p.projectId, slideId });
    if (!res.success) {
      setPageInputs({ status: "error", err: res.err });
      return;
    }

    const renderRes = await convertSlideToPageInputs(
      p.projectId,
      res.data.slide,
      0,
      config,
    );
    setPageInputs(getQueryStateFromApiResponse(renderRes));
  });

  return (
    <button
      type="button"
      class="border-base-300 hover:border-primary flex cursor-pointer flex-col gap-2 rounded border p-3 text-left transition-colors"
      onClick={p.onOpenEditor}
    >
      <div class="truncate text-sm font-600">{p.deck.label}</div>
      <div class="bg-base-200 aspect-video w-full overflow-hidden rounded">
        <Show
          when={pageInputs().status !== "loading" && pageInputs().status !== "error"}
          fallback={
            <div class="text-base-content/40 flex h-full items-center justify-center text-xs">
              <Show
                when={pageInputs().status === "loading"}
                fallback={
                  p.deck.firstSlideId ? <span>No preview</span> : <span>No slides</span>
                }
              >
                <span>Loading...</span>
              </Show>
            </div>
          }
        >
          <PageHolder
            pageInputs={(pageInputs() as { data: PageInputs }).data}
            pageWidthDu={PAGE_WIDTH_DU}
            pageHeightDu={PAGE_HEIGHT_DU}
            simpleError
          />
        </Show>
      </div>
    </button>
  );
}

function _AddDeckForm(
  p: AlertComponentProps<{ projectId: string }, { newDeckId: string }>,
) {
  const [tempLabel, setTempLabel] = createSignal("");

  const save = timActionForm(
    async (e: MouseEvent) => {
      e.preventDefault();
      if (!tempLabel().trim()) {
        return { success: false as const, err: "You must enter a name" };
      }
      return await serverActions.createSlideDeck({
        projectId: p.projectId,
        label: tempLabel().trim(),
      });
    },
    (data) => p.close({ newDeckId: data.deckId }),
  );

  return (
    <AlertFormHolder
      formId="add-slide-deck"
      header="Create slide deck"
      savingState={save.state()}
      saveFunc={save.click}
      cancelFunc={() => p.close(undefined)}
    >
      <Input
        label="Deck name"
        value={tempLabel()}
        onChange={setTempLabel}
        fullWidth
        autoFocus
      />
    </AlertFormHolder>
  );
}
