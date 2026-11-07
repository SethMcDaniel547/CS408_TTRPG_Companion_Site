import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar.jsx";

// Layout route for the Characters and Notes pages: a persistent sidebar with
// the page content in the main panel.
export default function SidebarLayout() {
  return (
    <section className="view split-view">
      <AppSidebar />
      <div className="split-main">
        <Outlet />
      </div>
    </section>
  );
}
