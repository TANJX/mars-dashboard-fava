import React from 'react';
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import { ModuleRegistry } from "ag-grid-community";
import { ClientSideRowModelModule, ValidationModule, TextEditorModule, CellStyleModule } from "ag-grid-community";

ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule, TextEditorModule, CellStyleModule]);

declare global {
    interface Window {
        marsDashboard: Root;
    }
}

// Unmount existing React app
if (window.marsDashboard) {
    console.log("Unmounting existing React app");
    window.marsDashboard.unmount();
}

const root = createRoot(document.getElementById("mars-dashboard")!);

root.render(
    <StrictMode>
        <App />
    </StrictMode>
);

window.marsDashboard = root;
