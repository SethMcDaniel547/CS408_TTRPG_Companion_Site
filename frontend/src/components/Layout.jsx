import { Outlet } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";

// Application shell: header, the routed page content, and the footer.
// Replaces the static <header>/<main>/<footer> that wrapped every view in the
// old index.html.
export default function Layout() {
  return (
    <>
      <SiteHeader />
      <main className="page-content">
        <Outlet />
      </main>
      <footer className="site-footer">Making game nights worse since October of 26</footer>
    </>
  );
}
