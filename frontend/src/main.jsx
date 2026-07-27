import { createRoot } from "react-dom/client";
import "./index.css";
import AppRoutes from "./routes/AppRoutes.jsx";
import PwaInstall from "./components/PwaInstall/PwaInstall.jsx";
import PwaUpdate from "./components/PwaUpdate/PwaUpdate.jsx";

createRoot(document.getElementById("root")).render(
  <>
    <AppRoutes />
    <PwaInstall />
    <PwaUpdate />
  </>
);
