const views = [...document.querySelectorAll(".view")];

async function getSession() {
  const response = await fetch("/api/auth/me");
  return response.json();
}

function showView(viewId) {
  views.forEach((view) => {
    view.hidden = view.id !== viewId;
  });
}

async function route() {
  const session = await getSession();
  const requestedView = window.location.pathname.slice(1) || (session.authenticated ? "account" : "home");
  const viewId = session.authenticated ? "account" : ["signin", "signup"].includes(requestedView) ? requestedView : "home";
  showView(viewId);
  if (session.authenticated) document.querySelector("[data-username]").textContent = session.username;
}

document.querySelectorAll(".auth-form").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector(".form-message");
    const submitButton = form.querySelector("button");
    submitButton.disabled = true;
    message.textContent = "Working...";
    const data = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`/api/auth/${form.dataset.auth}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to complete that request.");
      window.history.pushState({}, "", "/account");
      await route();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
});

document.querySelector("[data-signout]").addEventListener("click", async () => {
  await fetch("/api/auth/signout", { method: "POST" });
  window.history.pushState({}, "", "/");
  await route();
});

window.addEventListener("popstate", route);
route().catch(() => showView("home"));
