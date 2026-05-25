import { LoggedInWrapper } from "~/components/LoggedInWrapper";
import { CentralMain } from "~/components/central/index";

export default function CentralLoggedInWrapper() {
  return (
    <LoggedInWrapper>
      {(globalUser, attemptSignOut) => (
        <CentralMain globalUser={globalUser} attemptSignOut={attemptSignOut} />
      )}
    </LoggedInWrapper>
  );
}
