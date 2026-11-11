import { useEffect, useState } from "react";
import { SectionPreferencesContext } from "../../context/section-preferences-context";
import { createSectionScope } from "../../utils/sectionPreferences";
export default function SectionPreferencesProvider({ user, page, children }) {
  const account = user?.username || user?.id || "";
  const role = user?.role || "";
  const identity = JSON.stringify([account, role, page]);
  const [resolved, setResolved] = useState({ identity: null, scope: null });
  useEffect(() => {
    let active = true;
    void createSectionScope({ username: account, role }, page)
      .catch(() => null)
      .then(scope => { if (active) setResolved({ identity, scope }); });
    return () => { active = false; };
  }, [account, role, page, identity]);
  const current = resolved.identity === identity;
  return <SectionPreferencesContext.Provider value={{ scope: current ? resolved.scope : null, pending: !current, memoryScope: identity }}>{children}</SectionPreferencesContext.Provider>;
}
