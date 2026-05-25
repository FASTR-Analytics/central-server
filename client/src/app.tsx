import { Router, Route } from "@solidjs/router";
import { Suspense } from "solid-js";
import "./app.css";
import CentralLoggedInWrapper from "./routes/index";

export default function App() {
  return (
    <Router root={(p) => <Suspense>{p.children}</Suspense>}>
      <Route path="/*" component={CentralLoggedInWrapper} />
    </Router>
  );
}
