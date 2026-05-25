import type { JSX } from "solid-js";

type StyleRevealGroupProps = {
  children: JSX.Element;
};

export function StyleRevealGroup(p: StyleRevealGroupProps) {
  return (
    <div class="ui-spy-sm border-base-200 border-l-2 pl-3 ml-1">
      {p.children}
    </div>
  );
}

type StyleSectionProps = {
  label: JSX.Element;
  children: JSX.Element;
};

export function StyleSection(p: StyleSectionProps) {
  return (
    <div class="ui-spy-sm">
      <div class="text-xs font-700 text-primary uppercase tracking-wide">
        {p.label}
      </div>
      {p.children}
    </div>
  );
}
