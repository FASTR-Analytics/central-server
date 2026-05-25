import { AlertComponentProps, Button, ColorPicker, ModalContainer } from "panther";
import { For } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { CustomSeriesStyle } from "platform-lib";

export function CustomSeriesStyles(
  p: AlertComponentProps<
    { starting: CustomSeriesStyle[] | undefined },
    CustomSeriesStyle[]
  >,
) {
  const [tempStyles, setTempStyles] = createStore<CustomSeriesStyle[]>(
    structuredClone(
      p.starting ?? [{ color: "#74CEDF", lineStyle: "solid", strokeWidth: 5 }],
    ),
  );

  function add() {
    setTempStyles((prev) => [...prev, { color: "#74CEDF", lineStyle: "solid", strokeWidth: 5 }]);
  }

  function del(i: number) {
    setTempStyles((prev) => {
      if (prev.length === 1) return prev;
      return prev.toSpliced(i, 1);
    });
  }

  function update(i: number, color: string) {
    setTempStyles((prev) => {
      const newStyles = structuredClone(prev);
      newStyles[i].color = color;
      return newStyles;
    });
  }

  function done() {
    const finalStyles = unwrap(tempStyles);
    if (finalStyles.length === 0) {
      window.alert("You must have at least one color");
      return;
    }
    return p.close(finalStyles);
  }

  return (
    <ModalContainer
      title="Custom series colors"
      width="md"
      leftButtons={[
        <Button onClick={done} intent="success" iconName="save">Save</Button>,
        <Button onClick={() => p.close(undefined)} intent="neutral" iconName="x">Cancel</Button>,
      ]}
    >
      <div class="ui-spy-sm">
        <For each={tempStyles}>
          {(s, i) => (
            <div class="ui-gap-sm flex items-center">
              <div class="flex-none">{i() + 1}.</div>
              <div class="flex-1">
                <ColorPicker
                  value={s.color}
                  onChange={(c) => update(i(), c)}
                  position="right"
                  fullWidth
                />
              </div>
              <Button onClick={() => del(i())} iconName="trash" outline intent="neutral" />
            </div>
          )}
        </For>
        <div>
          <Button onClick={add} outline intent="success">Add</Button>
        </div>
      </div>
    </ModalContainer>
  );
}
