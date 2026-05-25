import { render } from "solid-js/web";
import { setGlobalStyle, setKeyColors } from "panther";
import App from "./app";

setKeyColors({
  base100: "white",
  base200: "#F2F2F2",
  base300: "#CACACA",
  baseContent: "#2A2A2A",
  primary: "#0E706C",
  primaryContent: "white",
  neutral: "rgb(161, 161, 161)",
  neutralContent: "#ffffff",
  success: "#009F70",
  successContent: "#ffffff",
  warning: "#d97706",
  warningContent: "#ffffff",
  danger: "#F04D44",
  dangerContent: "#ffffff",
});

setGlobalStyle({});

render(() => <App />, document.getElementById("app")!);
