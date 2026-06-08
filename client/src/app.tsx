import { Router, Route } from "@solidjs/router";
import { Suspense } from "solid-js";
import { AlertProvider, PopoverMenuProvider } from "panther";
import "./app.css";
import CentralLoggedInWrapper from "./routes/index";

export default function App() {
  return (
    <>
      <AlertProvider />
      <PopoverMenuProvider />
      <Router root={(p) => <Suspense>{p.children}</Suspense>}>
        <Route path="/*" component={CentralLoggedInWrapper} />
      </Router>
    </>
  );
}
