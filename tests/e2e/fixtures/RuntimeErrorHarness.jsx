/* eslint-disable react-refresh/only-export-components */
import {createRoot} from "react-dom/client";
import AppErrorBoundary from "../../../src/components/common/AppErrorBoundary.jsx";
import "../../../src/styles/index.css";
import "../../../src/styles/_variables.css";
import "../../../src/AppCoreTheme.module.css";
import "../../../src/AppCoreClientAppleTheme.css";

function BrokenScreen(){throw new TypeError("Cannot read properties of null (reading 'exerciseKey')");}
let attempts=0;
async function sendDiagnostic(diagnostic){
  attempts++;
  if(attempts===1)throw new Error("offline");
  document.getElementById("result").textContent=JSON.stringify(diagnostic);
}
createRoot(document.getElementById("root")).render(<><AppErrorBoundary sendDiagnostic={sendDiagnostic}><BrokenScreen/></AppErrorBoundary><output id="result" hidden/></>);
