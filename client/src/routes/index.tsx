import { LoggedInWrapper } from "~/components/LoggedInWrapper";
import { CentralMain } from "~/components/central/index";
import { InstanceSSEBoundary } from "~/state/instance/t1_sse";

export default function CentralLoggedInWrapper() {
  return (
    <LoggedInWrapper>
      {(globalUser, attemptSignOut) => (
        <InstanceSSEBoundary>
          <CentralMain globalUser={globalUser} attemptSignOut={attemptSignOut} />
        </InstanceSSEBoundary>
      )}
    </LoggedInWrapper>
  );
}
