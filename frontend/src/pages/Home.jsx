import { Link } from "react-router-dom";

// Landing page (view 1). Static marketing content.
export default function Home() {
  return (
    <section className="view view-home" aria-labelledby="home-title">
      <div className="hero-banner">
        <p className="eyebrow">still cant decide on a name</p>
        <h1 id="home-title">
          TTRPG <em>Companion</em>
        </h1>
        <p className="lead">
          A shared space for your party: game rooms, character sheets, a collaborative
          whiteboard, and notes you can pass across the table.
        </p>
      </div>
      <div className="action-row">
        <Link className="button button-pill" to="/signin">
          Sign in
        </Link>
        <Link className="button button-pill button-secondary" to="/signup">
          Create an account
        </Link>
      </div>
    </section>
  );
}
