import { createRoot } from "react-dom/client";
import "./index.css";
import AppRoutes from "./routes/AppRoutes.jsx";
import { prepareInitialTheme } from "./utils/themePreferences";
import "./components/Theme/Theme.css";
import PwaInstall from "./components/PwaInstall/PwaInstall.jsx";
import PwaUpdate from "./components/PwaUpdate/PwaUpdate.jsx";

prepareInitialTheme().then(() => createRoot(document.getElementById("root")).render(
  <>
    <AppRoutes />
    <PwaInstall />
    <PwaUpdate />
  </>
));
