import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

// Account creation (view 2). Same flow as SignIn but calls Api.signup.
export default function SignUp() {
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
      await Api.signup(data);
      await refresh();
      navigate("/lobby");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="view auth-view" aria-labelledby="signup-title">
      <p className="eyebrow"></p>
      <h1 id="signup-title">Create your account</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={32}
          pattern="[A-Za-z0-9_]+"
        />
        <label htmlFor="signup-email">
          Email <span>(optional)</span>
        </label>
        <input id="signup-email" name="email" type="email" autoComplete="email" />
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
        <button className="button" type="submit" disabled={submitting}>
          Sign up
        </button>
        <p className="form-message" role="status" aria-live="polite">
          {message}
        </p>
      </form>
      <p className="form-switch">
        Already have an account? <Link to="/signin">Sign in</Link>.
      </p>
    </section>
  );
}

