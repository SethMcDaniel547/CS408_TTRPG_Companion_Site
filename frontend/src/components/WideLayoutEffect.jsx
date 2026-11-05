import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// The original stylesheet widened .page-content for the multi-panel views using
// `body:has(#account:not([hidden]))` selectors. With client-side routing only
// one view is mounted at a time (no [hidden] siblings), so those selectors no
// longer match. This effect sets `data-wide` on <body> for the same set of
// routes, and styles.css widens the content for `body[data-wide]`.
const WIDE_ROUTES = new Set([
  "/account",
  "/character",
  "/room",
  "/room-settings",
  "/notes",
]);

export default function WideLayoutEffect() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (WIDE_ROUTES.has(pathname)) {
      document.body.setAttribute("data-wide", "");
    } else {
      document.body.removeAttribute("data-wide");
    }
  }, [pathname]);

  return null;
}
