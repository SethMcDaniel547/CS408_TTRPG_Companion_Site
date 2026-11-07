import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

// Sign in (view 2). Mirrors the old .auth-form submit handler: disable the
// button, post credentials via Api, refresh the session, then route to /lobby.
export default function SignIn() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("Working...");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await Api.signin(data);
      await refresh();
      navigate("/lobby");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="view auth-view" aria-labelledby="signin-title">
      <p className="eyebrow">Welcome back</p>
      <h1 id="signin-title">Sign in</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="signin-username">Username</label>
        <input
          id="signin-username"
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={32}
        />
        <label htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          maxLength={128}
        />
        <button className="button" type="submit" disabled={submitting}>
          Sign in
        </button>
        <p className="form-message" role="status" aria-live="polite">
          {message}
        </p>
      </form>
      <p className="form-switch">
        New user? <Link to="/signup">Create an account</Link>.
      </p>
    </section>
  );
}

