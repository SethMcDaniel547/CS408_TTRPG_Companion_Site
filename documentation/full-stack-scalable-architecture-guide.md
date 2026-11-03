# Full-Stack Architecture Guide

A compliance checklist for a scalable, production-grade Node.js + PostgreSQL app.
**Purpose:** feed this to an AI reviewer to verify the project follows these rules. Each rule is checkable. Flag any violation with the file and line.

**Stack:** Node.js/Express, PostgreSQL (`pg`), bcryptjs, socket.io, Jest + supertest.

---

## Core principle

Dependencies point inward. Business logic must not import HTTP, database drivers, or framework types directly — they are injected. Layer order, outer to inner:

```
Routes/Middleware  →  Controller  →  Service  →  Repository  →  PostgreSQL
   (HTTP only)        (adapter)     (domain)    (SQL only)
```

A layer may only call the one directly inside it. Never skip inward (e.g. controller → repository) and never call outward.

---

## Backend rules

1. **One layer, one job.**
   - Routes/middleware: wire URLs, auth, parsing. No business logic.
   - Controllers: translate `req`/`res` ↔ plain values. No SQL, no business rules.
   - Services: business rules only. No `req`/`res`, no raw SQL, no driver imports.
   - Repositories: the only place raw SQL and `pool.query` may appear.

2. **Inject dependencies via constructor.** No `new Service()` inside a handler; no hard-imported singletons used as collaborators. Instantiate wiring in one composition root.

3. **Validate at the controller boundary.** Never pass raw `req.body` into a service. Reject bad input before it reaches domain logic.

4. **Parameterized SQL only.** Always `$1, $2` placeholders — never string interpolation. Return `null` for not-found, not `undefined` or a throw.

5. **One connection pool.** A single shared `pg.Pool`; never create a pool or client per request.

6. **Typed errors.** Services throw domain errors (e.g. `AppError(message, statusCode)`); a single global error middleware maps them to HTTP responses. Controllers forward errors with `next(error)` — no ad-hoc `res.status(500)` scattered around.

7. **Transactions are explicit.** When a service needs atomicity, repositories accept an optional `client` so multiple writes share one `BEGIN…COMMIT`.

8. **Secrets from env only.** No credentials, connection strings, or keys in source. Hash passwords with bcrypt — never store or log plaintext.

### Reference: repository (SQL lives here, nowhere else)
```javascript
class UserRepository {
  constructor(pool) { this.pool = pool; }

  async findById(id) {
    const { rows } = await this.pool.query(
      "SELECT id, email FROM users WHERE id = $1", [id]
    );
    return rows[0] ?? null;
  }
}
```

### Reference: service (no HTTP, no SQL)
```javascript
class UserService {
  constructor(userRepo, crypto) { this.userRepo = userRepo; this.crypto = crypto; }

  async register(email, password) {
    if (!email.includes("@")) throw new AppError("INVALID_EMAIL", 400);
    const passwordHash = await this.crypto.hash(password);
    return this.userRepo.create({ email, passwordHash });
  }
}
```

### Reference: controller (HTTP adapter only)
```javascript
register = async (req, res, next) => {
  try {
    const { email, password } = validate(req.body);   // rule 3
    const user = await this.userService.register(email, password);
    res.status(201).json({ data: user });
  } catch (err) { next(err); }                          // rule 6
};
```

---

## Frontend rules

1. **Separate logic from markup.** Data fetching, state, and side effects live in one place (a module/hook/controller); view code stays declarative and reacts to state passed in.
2. **No inline `fetch`/`axios` buried in view code.** Route all API calls through a shared data layer so they can be reused, cached, and tested.
3. **Handle every async state.** Loading, error, and empty cases are always rendered — never assume success.

---

## Testing rules

1. **Unit-test services with mock dependencies.** Inject lightweight stubs via the constructor; do not mock module imports.
2. **Integration-test repositories against a real Postgres** (test DB/container) to catch SQL errors.
3. **Test HTTP routes with supertest**, asserting status codes and response shape.
4. Cover the failure path, not just the happy path.

### Reference: service unit test
```javascript
const repo = { create: jest.fn().mockResolvedValue({ id: 1 }) };
const crypto = { hash: jest.fn().mockResolvedValue("hashed") };
const service = new UserService(repo, crypto);

it("hashes the password before persisting", async () => {
  await service.register("a@b.com", "pw");
  expect(crypto.hash).toHaveBeenCalledWith("pw");
  expect(repo.create).toHaveBeenCalledWith({ email: "a@b.com", passwordHash: "hashed" });
});
```

---

## Reviewer checklist

Scan the project and flag each violation (file + line):

- [ ] Raw SQL or `pool.query` outside a repository
- [ ] `req`/`res` referenced outside controllers/middleware
- [ ] Unvalidated `req.body` reaching a service
- [ ] String-interpolated SQL (injection risk)
- [ ] `new Service()`/`new Repository()` inside a handler instead of injected
- [ ] More than one `pg.Pool`, or a pool/client created per request
- [ ] Secrets or connection strings hard-coded in source
- [ ] Plaintext passwords stored or logged
- [ ] `fetch`/`axios` calls embedded directly in view code
- [ ] Services with no unit tests, or repositories with no integration tests
