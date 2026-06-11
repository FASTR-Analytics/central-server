import { t3, TC } from "platform-lib";
import type { VisualizationFolder, VisualizationGroupingMode } from "platform-lib";
import {
  Button,
  ChartHolder,
  createSelectionController,
  FrameLeftResizable,
  getColor,
  HeadingBar,
  openComponent,
  Select,
  SelectionCircle,
  SelectList,
  showMenu,
  timActionDelete,
  timQuery,
  type ListItem,
  type MenuItem,
} from "panther";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { PeriodOption } from "platform-lib";
import {
  getFetchConfigFromPresentationObjectConfig,
  type PresentationObjectConfig,
} from "platform-lib";
import { parseCentralPresentationObjectConfig } from "~/disaggregation_helpers";
import { serverActions, type ProjectMetric, type PresentationObjectSummary } from "~/server_actions";
import { getFigureInputsFromPresentationObject } from "~/generate_visualization/get_figure_inputs_from_po";
import { projectState } from "~/state/project/t1_store";
import {
  vizGroupingMode,
  setVizGroupingMode,
  vizSelectedGroup,
  setVizSelectedGroup,
} from "~/state/ui";
import { EditFolderModal } from "./edit_folder_modal";
import { MoveToFolderModal } from "./move_to_folder_modal";
import { DuplicateVisualization } from "~/components/visualization/duplicate_visualization";

function getGroupingOptions(): {
  value: VisualizationGroupingMode;
  label: string;
}[] {
  return [
    { value: "folders", label: t3({ en: "By folder", fr: "Par dossier" }) },
    { value: "metric", label: t3({ en: "By metric", fr: "Par métrique" }) },
    { value: "flat", label: t3({ en: "Flat list", fr: "Liste plate" }) },
  ];
}

type GroupOption = {
  value: string;
  label: string;
  count: number;
  color?: string | null;
};

type SubGroupConfig = {
  getGroupKey: (po: PresentationObjectSummary) => string;
  getGroupLabel: (key: string) => string;
  getGroupOrder: () => string[];
};

type MetricGroup = {
  label: string;
  variants: ProjectMetric[];
};

function groupMetricsByLabel(metrics: ProjectMetric[]): MetricGroup[] {
  const labelMap = new Map<string, ProjectMetric[]>();

  for (const metric of metrics) {
    if (!labelMap.has(metric.label)) {
      labelMap.set(metric.label, []);
    }
    labelMap.get(metric.label)!.push(metric);
  }

  return Array.from(labelMap.entries())
    .map(([label, variants]) => ({
      label,
      variants: variants.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.variants[0].id.localeCompare(b.variants[0].id));
}

type Props = {
  projectId: string;
  canConfigure: boolean;
  onOpenEditor: (id: string | null) => void;
};

export function VisualizationsList(p: Props) {
  const [searchText, setSearchText] = createSignal<string>("");

  return (
    <div class="flex h-full w-full min-w-0 flex-col">
      <HeadingBar
        heading={t3({ en: "Visualizations", fr: "Visualisations" })}
        searchText={searchText()}
        setSearchText={setSearchText}
        class="border-base-300"
        ensureHeightAsIfButton
      >
        <Show when={p.canConfigure}>
          <Button intent="primary" iconName="plus" size="sm" onClick={() => p.onOpenEditor(null)}>
            {t3({ en: "Create visualization", fr: "Créer une visualisation" })}
          </Button>
        </Show>
      </HeadingBar>
      <div class="min-h-0 w-full flex-1">
        <PresentationObjectPanelDisplay
          projectId={p.projectId}
          visualizations={projectState.visualizations}
          metrics={projectState.metrics}
          folders={projectState.visualizationFolders}
          searchText={searchText().trim()}
          canConfigure={p.canConfigure}
          onClick={(po) => p.onOpenEditor(po.id)}
        />
      </div>
    </div>
  );
}

type PanelProps = {
  projectId: string;
  visualizations: PresentationObjectSummary[];
  metrics: ProjectMetric[];
  folders: VisualizationFolder[];
  searchText: string;
  canConfigure: boolean;
  onClick: (presentationObject: PresentationObjectSummary) => void;
};

function PresentationObjectPanelDisplay(p: PanelProps) {
  const metricLookup = () => new Map(p.metrics.map((m) => [m.id, m]));

  const filteredBySearch = () => {
    const vizs = p.visualizations;

    if (p.searchText.length < 3) return vizs;
    const searchLower = p.searchText.toLowerCase();
    return vizs.filter((po) => po.label.toLowerCase().includes(searchLower));
  };

  const groupOptions = (): GroupOption[] => {
    const vizs = filteredBySearch();
    const mode = vizGroupingMode();

    switch (mode) {
      case "folders": {
        const generalCount = vizs.filter((v) => v.folderId === null).length;
        const groups: GroupOption[] = [
          { value: "_unfiled", label: t3(TC.general), count: generalCount },
        ];
        groups.push(
          ...p.folders.map((f) => ({
            value: f.id,
            label: f.label,
            count: vizs.filter((v) => v.folderId === f.id).length,
            color: f.color,
          })),
        );
        return groups;
      }

      case "metric": {
        const metricGroups = groupMetricsByLabel(p.metrics);
        return metricGroups
          .filter((group) => {
            // Only include groups that have visualizations
            return group.variants.some((m) =>
              vizs.some((v) => v.metricId === m.id),
            );
          })
          .map((group) => {
            const count = group.variants.reduce(
              (sum, m) => sum + vizs.filter((v) => v.metricId === m.id).length,
              0,
            );
            return {
              value: group.label,
              label: group.label,
              count,
            };
          });
      }

      case "flat":
        return [
          {
            value: "_all",
            label: t3({
              en: "All Visualizations",
              fr: "Toutes les visualisations",
            }),
            count: vizs.length,
          },
        ];

      default:
        return [];
    }
  };

  const filteredVisualizations = () => {
    const vizs = filteredBySearch();
    const group = vizSelectedGroup();
    const mode = vizGroupingMode();

    if (!group) return [];

    switch (mode) {
      case "folders":
        if (group === "_unfiled") {
          return vizs.filter((v) => v.folderId === null);
        }
        return vizs.filter((v) => v.folderId === group);

      case "metric": {
        // group is the metric label, find all metric IDs with that label
        const metricGroups = groupMetricsByLabel(p.metrics);
        const metricGroup = metricGroups.find((g) => g.label === group);
        if (!metricGroup) return [];
        const metricIds = new Set(metricGroup.variants.map((m) => m.id));
        return vizs.filter((v) => metricIds.has(v.metricId));
      }

      case "flat":
        return [...vizs].sort((a, b) => a.label.localeCompare(b.label));

      default:
        return vizs;
    }
  };

  const subGroupConfig = (): SubGroupConfig | null => {
    const group = vizSelectedGroup();
    const mode = vizGroupingMode();

    // Sub-group by variant for metric view (only if metric has multiple variants)
    if (mode === "metric" && group) {
      const metricGroups = groupMetricsByLabel(p.metrics);
      const metricGroup = metricGroups.find((g) => g.label === group);
      if (metricGroup && metricGroup.variants.length > 1) {
        const lookup = metricLookup();
        return {
          getGroupKey: (po) => po.metricId,
          getGroupLabel: (key) => {
            const metric = lookup.get(key);
            return metric?.variantLabel || "Default";
          },
          getGroupOrder: () => metricGroup.variants.map((m) => m.id),
        };
      }
    }

    return null;
  };

  createEffect(() => {
    vizGroupingMode();
    const groups = groupOptions();
    const current = vizSelectedGroup();
    if (groups.length > 0 && !groups.find((g) => g.value === current)) {
      setVizSelectedGroup(groups[0].value);
    }
  });

  function handleFolderContextMenu(e: MouseEvent, folderId: string) {
    e.preventDefault();
    e.stopPropagation();
    const folder = p.folders.find((f) => f.id === folderId);
    if (!folder) return;

    const items: MenuItem[] = [
      {
        label: t3({
          en: "Rename / Change color...",
          fr: "Renommer / Changer la couleur...",
        }),
        icon: "pencil",
        onClick: async () => {
          await openComponent({
            element: EditFolderModal,
            props: {
              projectId: p.projectId,
              folder,
            },
          });
        },
      },
      {
        label: t3({ en: "Delete folder", fr: "Supprimer le dossier" }),
        icon: "trash",
        intent: "danger",
        onClick: async () => {
          const deleteAction = timActionDelete(
            t3({
              en: "Are you sure you want to delete this folder? Visualizations will be moved to General.",
              fr: "Êtes-vous sûr de vouloir supprimer ce dossier ? Les visualisations seront déplacées dans Général.",
            }),
            () =>
              serverActions.deleteVisualizationFolder({
                projectId: p.projectId,
                folderId,
              }),
            () => {},
          );
          await deleteAction.click();
        },
      },
    ];
    showMenu({
      anchor: { x: e.clientX, y: e.clientY, width: 0, height: 0 },
      items,
    });
  }

  const renderGroupOption = (item: ListItem<string>) => {
    const opt = groupOptions().find((g) => g.value === item.id);
    if (!opt) return <span>{item.label}</span>;

    const mode = vizGroupingMode();
    if (mode === "folders") {
      const isUserFolder = !item.id.startsWith("_");
      return (
        <div
          class="flex items-center gap-2"
          onContextMenu={
            isUserFolder && p.canConfigure
              ? (e) => handleFolderContextMenu(e, item.id)
              : undefined
          }
        >
          <div
            class="h-2.5 w-2.5 flex-none rounded-full"
            style={{
              "background-color": opt.color ?? getColor({ key: "base300" }),
            }}
          />
          <span class="flex-1 truncate">{opt.label}</span>
          <span class="text-neutral text-xs">({opt.count})</span>
        </div>
      );
    }
    return (
      <div class="flex items-center justify-between gap-2">
        <span class="truncate">{opt.label}</span>
        <span class="text-neutral text-xs">({opt.count})</span>
      </div>
    );
  };

  return (
    <FrameLeftResizable
      startingWidth={180}
      minWidth={170}
      maxWidth={300}
      hoverOffset="offset-for-border-1-on-left"
      panelChildren={
        <div class="border-base-300 flex h-full w-full flex-col border-r">
          <div class="border-base-300 border-b p-3">
            <Select
              options={getGroupingOptions()}
              value={vizGroupingMode()}
              onChange={(v) =>
                setVizGroupingMode(v as VisualizationGroupingMode)
              }
              fullWidth
            />
          </div>
          <div class="flex-1 overflow-auto p-2">
            <SelectList
              items={groupOptions().map((g) => ({
                id: g.value,
                label: g.label,
              }))}
              value={vizSelectedGroup() ?? undefined}
              onChange={setVizSelectedGroup}
              renderItem={renderGroupOption}
              fullWidth
            />
            <Show when={vizGroupingMode() === "folders" && p.canConfigure}>
              <div class="py-3">
                <Button
                  size="sm"
                  outline
                  iconName="plus"
                  onClick={async () => {
                    await openComponent({
                      element: EditFolderModal,
                      props: { projectId: p.projectId },
                    });
                  }}
                >
                  {t3({ en: "New folder", fr: "Nouveau dossier" })}
                </Button>
              </div>
            </Show>
          </div>
        </div>
      }
    >
      <VisualizationGrid
        projectId={p.projectId}
        visualizations={filteredVisualizations()}
        folders={p.folders}
        metrics={p.metrics}
        subGroupConfig={subGroupConfig()}
        canConfigure={p.canConfigure}
        onClick={p.onClick}
        searchText={p.searchText}
      />
    </FrameLeftResizable>
  );
}

type VisualizationGridProps = {
  projectId: string;
  visualizations: PresentationObjectSummary[];
  folders: VisualizationFolder[];
  metrics: ProjectMetric[];
  subGroupConfig: SubGroupConfig | null;
  canConfigure: boolean;
  onClick: (po: PresentationObjectSummary) => void;
  searchText: string;
};

function VisualizationGrid(p: VisualizationGridProps) {
  const getOrderedVisualizationIds = (): string[] => {
    if (!p.subGroupConfig) {
      return p.visualizations.map((po) => po.id);
    }

    const { getGroupKey, getGroupOrder } = p.subGroupConfig;
    const order = getGroupOrder();
    const groups = new Map<string, PresentationObjectSummary[]>();

    for (const po of p.visualizations) {
      const key = getGroupKey(po);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(po);
    }

    const keys =
      order.length > 0
        ? [
            ...order.filter((key) => groups.has(key)),
            ...Array.from(groups.keys()).filter((key) => !order.includes(key)),
          ]
        : Array.from(groups.keys());

    const orderedIds: string[] = [];
    for (const key of keys) {
      const items = groups.get(key)!;
      for (const po of items) {
        orderedIds.push(po.id);
      }
    }
    return orderedIds;
  };

  const selection = createSelectionController<string>({
    ids: () => getOrderedVisualizationIds(),
    mode: "multi",
  });

  const visualIndexMap = (): Map<string, number> => {
    const ids = getOrderedVisualizationIds();
    const map = new Map<string, number>();
    ids.forEach((id, idx) => map.set(id, idx));
    return map;
  };

  async function handleMoveToFolder(po: PresentationObjectSummary) {
    const idsToMove = selection.getBatchIds(po.id);

    await openComponent({
      element: MoveToFolderModal,
      props: {
        projectId: p.projectId,
        presentationObjectIds: idsToMove,
        currentFolderId: po.folderId,
        folders: p.folders,
      },
    });

    selection.clear();
  }

  async function handleDuplicate(po: PresentationObjectSummary) {
    const idsToDuplicate = selection.getBatchIds(po.id);

    const poDetails = idsToDuplicate
      .map((id) => p.visualizations.find((v) => v.id === id))
      .filter((v): v is PresentationObjectSummary => v !== undefined)
      .map((v) => ({ id: v.id, label: v.label, folderId: v.folderId }));

    await openComponent({
      element: DuplicateVisualization,
      props: {
        projectId: p.projectId,
        poDetails,
        folders: p.folders,
      },
    });

    selection.clear();
  }

  async function handleDelete(po: PresentationObjectSummary) {
    const idsToDelete = selection.getBatchIds(po.id);
    const confirmText =
      idsToDelete.length > 1
        ? t3({
            en: `Are you sure you want to delete ${idsToDelete.length} visualizations?`,
            fr: `Êtes-vous sûr de vouloir supprimer ${idsToDelete.length} visualisations ?`,
          })
        : t3({
            en: "Are you sure you want to delete this visualization?",
            fr: "Êtes-vous sûr de vouloir supprimer cette visualisation ?",
          });

    const deleteAction = timActionDelete(
      confirmText,
      async () => {
        const promises = idsToDelete.map((id) =>
          serverActions.deletePresentationObject({
            projectId: p.projectId,
            id,
          }),
        );
        const results = await Promise.all(promises);
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          return failed[0];
        }
        return results[0];
      },
      () => {
        selection.clear();
        // SSE will handle refresh
      },
    );
    await deleteAction.click();
  }

  const renderCard = (po: PresentationObjectSummary, index: number) => (
    <VisualizationCard
      projectId={p.projectId}
      po={po}
      metrics={p.metrics}
      isSelected={selection.isSelected(po.id)}
      selectedCount={selection.selectedCount()}
      index={index}
      canConfigure={p.canConfigure}
      onCardClick={(e) => {
        e.stopPropagation();
        selection.handleClick(po.id, e, () => p.onClick(po));
      }}
      onCircleClick={(e) => selection.handleClick(po.id, e)}
      onOpen={() => p.onClick(po)}
      onDuplicate={() => handleDuplicate(po)}
      onDelete={() => handleDelete(po)}
      onMoveToFolder={() => handleMoveToFolder(po)}
    />
  );

  const emptyMessage = () => (
    <div class="text-neutral text-sm">
      {p.searchText.length >= 3
        ? t3({
            en: "No matching visualizations",
            fr: "Aucune visualisation correspondante",
          })
        : t3({ en: "No visualizations", fr: "Aucune visualisation" })}
    </div>
  );

  return (
    <Show
      when={p.subGroupConfig}
      fallback={
        <div
          class="ui-pad ui-gap grid h-full w-full grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] content-start items-start overflow-auto"
          onClick={() => selection.clear()}
        >
          <For each={p.visualizations} fallback={emptyMessage()}>
            {(po, i) => renderCard(po, i())}
          </For>
        </div>
      }
    >
      {(config) => {
        const grouped = () => {
          const { getGroupKey, getGroupLabel, getGroupOrder } = config();
          const order = getGroupOrder();
          const groups = new Map<string, PresentationObjectSummary[]>();

          for (const po of p.visualizations) {
            const key = getGroupKey(po);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(po);
          }

          // Use provided order, or natural order from visualizations if order is empty
          const keys =
            order.length > 0
              ? [
                  ...order.filter((key) => groups.has(key)),
                  ...Array.from(groups.keys()).filter(
                    (key) => !order.includes(key),
                  ),
                ]
              : Array.from(groups.keys());

          return keys.map((key) => ({
            key,
            label: getGroupLabel(key),
            items: groups.get(key)!,
          }));
        };

        return (
          <div
            class="h-full w-full overflow-auto"
            onClick={() => selection.clear()}
          >
            <Show
              when={grouped().length > 0}
              fallback={<div class="ui-pad">{emptyMessage()}</div>}
            >
              <For each={grouped()}>
                {(group, i) => (
                  <div
                    class="mb-6"
                    classList={{ "pt-4": i() === 0, "pt-2": i() > 0 }}
                  >
                    <div class="border-base-300 mx-4 mb-3 flex items-center gap-3 border-b pb-2">
                      <span class="text-base-content font-700 text-sm">
                        {group.label}
                      </span>
                      <span class="text-neutral text-xs">
                        ({group.items.length})
                      </span>
                    </div>
                    <div class="ui-gap grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] content-start items-start px-4 pt-1 pb-4">
                      <For each={group.items}>
                        {(po) =>
                          renderCard(po, visualIndexMap().get(po.id) ?? 0)
                        }
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        );
      }}
    </Show>
  );
}

type VisualizationCardProps = {
  projectId: string;
  po: PresentationObjectSummary;
  metrics: ProjectMetric[];
  isSelected: boolean;
  selectedCount: number;
  index: number;
  canConfigure: boolean;
  onOpen: () => void;
  onCardClick: (e: MouseEvent) => void;
  onCircleClick: (e: MouseEvent) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveToFolder: () => void;
};

function VisualizationCard(p: VisualizationCardProps) {
  async function handleContextMenu(e: MouseEvent) {
    e.preventDefault();

    if (!p.canConfigure) return;

    const isMultiSelect = p.isSelected && p.selectedCount > 1;

    const deleteLabel = isMultiSelect
      ? t3({
          en: `Delete ${p.selectedCount} visualizations`,
          fr: `Supprimer ${p.selectedCount} visualisations`,
        })
      : t3(TC.delete);

    const moveToFolderLabel = isMultiSelect
      ? t3({
          en: `Move ${p.selectedCount} visualizations to folder...`,
          fr: `Déplacer ${p.selectedCount} visualisations vers un dossier...`,
        })
      : t3({ en: "Move to folder...", fr: "Déplacer vers un dossier..." });

    const duplicateLabel = isMultiSelect
      ? t3({
          en: `Duplicate ${p.selectedCount} visualizations...`,
          fr: `Dupliquer ${p.selectedCount} visualisations...`,
        })
      : t3({ en: "Duplicate...", fr: "Dupliquer..." });

    const items: MenuItem[] = [];

    if (!isMultiSelect) {
      items.push({
        label: t3({
          en: "Edit visualization",
          fr: "Modifier la visualisation",
        }),
        icon: "pencil",
        onClick: p.onOpen,
      });
    }
    items.push(
      {
        label: moveToFolderLabel,
        icon: "folder",
        onClick: p.onMoveToFolder,
      },
      {
        label: duplicateLabel,
        icon: "copy",
        onClick: p.onDuplicate,
      },
      {
        label: deleteLabel,
        icon: "trash",
        intent: "danger",
        onClick: p.onDelete,
      },
    );
    showMenu({
      anchor: { x: e.clientX, y: e.clientY, width: 0, height: 0 },
      items,
    });
  }

  return (
    <div class="group bg-base-100 row-span-3 grid grid-rows-subgrid gap-y-1 ring-offset-[6px]">
      <div class="ui-gap-sm flex items-end pb-1">
        <div class="font-400 text-base-content pointer-events-none text-xs italic select-none">
          {p.po.label}
        </div>
      </div>
      <div
        class="relative cursor-pointer rounded border p-2"
        classList={{
          "border-base-300": !p.isSelected,
          "border-primary": p.isSelected,
          "hover:border-primary": !p.isSelected,
        }}
        onClick={p.onCardClick}
        onContextMenu={handleContextMenu}
      >
        <SelectionCircle isSelected={p.isSelected} onClick={p.onCircleClick} />
        <VizPreview projectId={p.projectId} po={p.po} metrics={p.metrics} />
      </div>
      <div class="ui-gap-sm flex items-start justify-end pt-1 select-none">
        <div class="text-base-content/40 text-xs">{p.po.type}</div>
      </div>
    </div>
  );
}

type VizPreviewProps = {
  projectId: string;
  po: PresentationObjectSummary;
  metrics: ProjectMetric[];
};

function VizPreview(p: VizPreviewProps) {
  const previewQuery = timQuery(async () => {
    const detail = await serverActions.getPresentationObject({ projectId: p.projectId, id: p.po.id });
    if (!detail.success) return { success: false as const, err: detail.err };

    const metric = p.metrics.find((m) => m.id === detail.data.metricId);
    if (!metric) return { success: false as const, err: "Metric not found" };

    let config: PresentationObjectConfig;
    try {
      config = parseCentralPresentationObjectConfig(JSON.stringify(detail.data.config));
    } catch {
      return { success: false as const, err: "Invalid config" };
    }

    const parsedPostAggExpr = (() => {
      try { return metric.postAggregationExpression ? JSON.parse(metric.postAggregationExpression) : undefined; }
      catch { return undefined; }
    })();
    const fetchConfigResult = getFetchConfigFromPresentationObjectConfig(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { valueProps: JSON.parse(metric.valueProps ?? "[]"), valueFunc: metric.valueFunc, formatAs: metric.formatAs, postAggregationExpression: parsedPostAggExpr } as any,
      config,
    );
    if (!fetchConfigResult.success) {
      return { success: false as const, err: "Bad fetch config" };
    }

    const periodOpts = JSON.parse(metric.requiredDisaggregationOptions ?? "[]") as string[];
    const firstPeriodOption = periodOpts.find(
      (d) => d === "period_id" || d === "year" || d === "quarter_id",
    ) as PeriodOption | undefined;

    const items = await serverActions.getPresentationObjectItems({
      projectId: p.projectId,
      resultsObjectId: metric.resultsObjectId,
      fetchConfig: fetchConfigResult.data,
      firstPeriodOption,
      moduleLastRun: metric.lastRunAt,
    });
    if (!items.success) return { success: false as const, err: items.err };

    return { success: true as const, data: { config, metric, items: items.data } };
  }, "Loading...");

  const chartData = createMemo(() => {
    const s = previewQuery.state();
    if (s.status !== "ready" || !s.data) return null;
    const { config, metric, items } = s.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!items || (items as any).status !== "ok") return null;

    const fi = getFigureInputsFromPresentationObject(
      {
        id: metric.id,
        valueProps: JSON.parse(metric.valueProps ?? "[]"),
        valueFunc: metric.valueFunc,
        formatAs: metric.formatAs as "percent" | "number",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items as any,
      config,
    );
    if (fi.status !== "ready") return null;
    return fi.data;
  });

  return (
    <div class="bg-base-200 aspect-video w-full overflow-hidden rounded">
      <Show
        when={chartData()}
        keyed
        fallback={
          <div class="text-base-content/40 flex h-full items-center justify-center text-xs">
            <Show
              when={previewQuery.state().status === "loading"}
              fallback={<span>No preview</span>}
            >
              <span>Loading...</span>
            </Show>
          </div>
        }
      >
        {(data) => (
          <ChartHolder
            chartInputs={data}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            height={"tableData" in (data as any) ? "ideal" : "flex"}
          />
        )}
      </Show>
    </div>
  );
}
