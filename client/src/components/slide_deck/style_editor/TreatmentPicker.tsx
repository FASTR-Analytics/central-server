import { For } from "solid-js";
import {
  getCoverTreatments,
  getFreeformTreatments,
  type CoverTreatmentId,
  type FreeformTreatmentId,
} from "panther";
import { PresetCard } from "./PresetCard.tsx";

const THUMBNAIL_PRIMARY = "#64748b";
const THUMBNAIL_BASE_100 = "#ffffff";
const THUMBNAIL_BASE_200 = "#e5e7eb";

type CoverTreatmentPickerProps = {
  value: CoverTreatmentId;
  onChange: (id: CoverTreatmentId) => void;
};

function CoverThumbnail(p: { treatmentId: CoverTreatmentId }) {
  const bgStyle = (): string => {
    switch (p.treatmentId) {
      case "bold":
      case "muted":
        return THUMBNAIL_PRIMARY;
      case "light":
        return THUMBNAIL_BASE_200;
      default:
        return THUMBNAIL_BASE_100;
    }
  };

  const titleStyle = (): string => {
    switch (p.treatmentId) {
      case "bold":
        return THUMBNAIL_BASE_100;
      case "muted":
        return "#d4d4d8";
      case "light":
      case "lighter":
      case "white":
        return THUMBNAIL_PRIMARY;
      default:
        return "#374151";
    }
  };

  return (
    <div
      class="absolute inset-0 flex items-center justify-center"
      style={{ background: bgStyle() }}
    >
      <div class="h-1.5 w-8 rounded-sm" style={{ background: titleStyle() }} />
    </div>
  );
}

export function CoverTreatmentPicker(p: CoverTreatmentPickerProps) {
  const presets = getCoverTreatments();

  return (
    <div>
      <div class="ui-label">Cover & Section</div>
      <div class="ui-gap-sm flex flex-wrap">
        <For each={presets}>
          {(preset) => (
            <PresetCard
              name={preset.name}
              selected={p.value === preset.id}
              onClick={() => p.onChange(preset.id)}
            >
              <CoverThumbnail treatmentId={preset.id} />
            </PresetCard>
          )}
        </For>
      </div>
    </div>
  );
}

type FreeformTreatmentPickerProps = {
  value: FreeformTreatmentId;
  onChange: (id: FreeformTreatmentId) => void;
};

function FreeformThumbnail(p: { treatmentId: FreeformTreatmentId }) {
  const headerStyle = (): { bg: string; border?: string } => {
    switch (p.treatmentId) {
      case "bold":
      case "header-only":
        return { bg: THUMBNAIL_PRIMARY };
      case "bordered":
      case "bordered-accent":
        return { bg: THUMBNAIL_BASE_100, border: THUMBNAIL_PRIMARY };
      default:
        return { bg: THUMBNAIL_BASE_100 };
    }
  };

  const footerStyle = (): { bg: string } => {
    switch (p.treatmentId) {
      case "bordered":
      case "bordered-accent":
      case "minimal":
      case "minimal-accent":
      case "header-only":
        return { bg: THUMBNAIL_BASE_100 };
      case "default":
      case "soft":
      case "soft-accent":
        return { bg: THUMBNAIL_BASE_200 };
      default:
        return { bg: THUMBNAIL_PRIMARY };
    }
  };

  return (
    <div class="absolute inset-0 flex flex-col" style={{ background: THUMBNAIL_BASE_100 }}>
      <div
        class="h-3 flex-none"
        style={{
          background: headerStyle().bg,
          "border-bottom": headerStyle().border
            ? `1px solid ${headerStyle().border}`
            : undefined,
        }}
      />
      <div class="flex-1" />
      <div class="h-2 flex-none" style={{ background: footerStyle().bg }} />
    </div>
  );
}

export function FreeformTreatmentPicker(p: FreeformTreatmentPickerProps) {
  const presets = getFreeformTreatments();

  return (
    <div>
      <div class="ui-label">Content Pages</div>
      <div class="ui-gap-sm flex flex-wrap">
        <For each={presets}>
          {(preset) => (
            <PresetCard
              name={preset.name}
              selected={p.value === preset.id}
              onClick={() => p.onChange(preset.id)}
            >
              <FreeformThumbnail treatmentId={preset.id} />
            </PresetCard>
          )}
        </For>
      </div>
    </div>
  );
}
