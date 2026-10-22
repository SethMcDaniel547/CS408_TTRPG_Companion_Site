# Future security fixes

Checkpoint 2 uses a practical baseline for account authentication:

- Passwords are hashed with `bcryptjs.hash(password, 12)` and checked with
  `bcryptjs.compare`; plaintext passwords are never inserted into PostgreSQL.
- Authentication creates a cryptographically random token with
  `crypto.randomBytes(32)`. The token is held in an in-memory session store and
  sent as an `HttpOnly`, `SameSite=Lax` cookie. Production also adds `Secure`.
- PostgreSQL queries use the `pg` pool and parameterized query placeholders.

## Current limitations and trade-offs

Sessions are intentionally in memory for this checkpoint. Restarting the
process signs everyone out, and multiple application instances cannot share
sessions. This avoids storing session secrets in the browser or on local disk
while keeping the deployment simple, but it is not the final approach for a
multi-instance production deployment. The account schema is created at startup
on the first authentication request rather than through a full migration
system.

## Hardening planned for future iterations

1. Move sessions to a shared, expiring store such as Redis and rotate the
   session token after login.
2. Add CSRF protection for state-changing requests, rate limiting and account
   lockout/backoff for repeated login failures.
3. Add email verification, password reset tokens with short expirations, and
   password-strength feedback.
4. Add database migrations, stricter email validation, audit logging, and
   monitoring that does not record passwords or session tokens.
5. Require HTTPS at the proxy, set a production session secret/store policy,
   and configure PostgreSQL TLS verification (`DB_SSL=true`) for managed
   database services.
