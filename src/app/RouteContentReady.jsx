import { useEffect } from "react";
import { recordStartupStage } from "../utils/performanceChecks.js";

export default function RouteContentReady({ route, children }) {
  useEffect(() => { recordStartupStage("route-content-ready", { route }); }, [route]);
  return children;
}
