import { createRoot } from "react-dom/client";
import Preview from "./PreviewApp";
import { prepareInitialTheme } from "../../src/utils/themePreferences";
const username = new URLSearchParams(window.location.search).get("account") || "ui-preview-a";
prepareInitialTheme({ username }).then(() => createRoot(document.getElementById("root")).render(<Preview />));
