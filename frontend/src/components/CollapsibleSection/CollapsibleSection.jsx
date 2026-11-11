import { useContext, useId, useState } from "react";
import { SectionPreferencesContext } from "../../context/section-preferences-context";
import { getSectionStorage, sectionPreferenceKey, readSectionPreference, writeSectionPreference } from "../../utils/sectionPreferences";
import "./CollapsibleSection.css";

export default function CollapsibleSection({ title, sectionId, children, headingLevel = 2, badge, ref: sectionRef, ...props }) {
  const { scope, pending, memoryScope } = useContext(SectionPreferencesContext);
  const contentId = useId();
  const key = sectionPreferenceKey(scope, sectionId || title);
  const memoryKey = key || JSON.stringify([memoryScope, sectionId || title]);
  const storage = getSectionStorage();
  const [selection, setSelection] = useState({ key: null, open: false });
  const open = selection.key === memoryKey ? selection.open : readSectionPreference(storage, key);
  function toggle() {
    const next = !open;
    setSelection({ key: memoryKey, open: next });
    writeSectionPreference(storage, key, next);
  }
  return (
    <section {...props} ref={sectionRef} data-collapsible-section="" data-open={open}>
      <div className="collapsible-section-heading" role="heading" aria-level={headingLevel}>
        <button type="button" className="collapsible-section-trigger" aria-expanded={open} aria-controls={contentId} onClick={toggle} disabled={pending}>
          <span className="collapsible-section-title">{title}</span>
          {badge && <span className="collapsible-section-badge">{badge}</span>}
          <span className="collapsible-section-arrow" aria-hidden="true">⌄</span>
        </button>
      </div>
      <div id={contentId} hidden={!open} className="collapsible-section-content">{children}</div>
    </section>
  );
}
