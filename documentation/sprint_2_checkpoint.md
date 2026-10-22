# Checkpoint 2: Environment Setup and Authentication

## Objective
Establish the foundational backend database, deployment-ready environment configuration, and user authentication flow (Sign Up & Sign In) with secure session handling for future per-user access.

---

## 1. Database Schema (`accounts` Table)
Connect the application to a PostgreSQL database and create the `accounts` table with the following structure:

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto-increment |
| `username` | `VARCHAR` | Unique, Not Null |
| `password_hash` | `VARCHAR` | Not Null (stores securely hashed passwords) |
| `email` | `VARCHAR` | *Optional/Nullable* (prepared ahead of time for future "forgot password" features) |

---

## 2. Frontend & User Flow Requirements
* **Landing Page:** Provide a clear entry point allowing the user to navigate to either **Sign In** or **Sign Up**.
* **Sign Up Page:**
  * Collects a unique username and password.
  * Hashes the password securely using a standard industry algorithm (e.g., `bcrypt` or `Argon2`) prior to database insertion. *Do not store plaintext passwords.*
  * Inserts the new user record into the PostgreSQL database.
* **Sign In Page:**
  * Authenticates user credentials against the database records.
  * Upon successful authentication, issues a verification token or secure session cookie to prove identity for subsequent protected routes.

---

## 3. Production Readiness (AWS EC2)
* **Environment Variables:** Configure all sensitive configurations (database connection strings, session secrets/JWT keys, port numbers) via environment variables (`.env` files / system environment variables) rather than hardcoding them.
* **Deployment Compatibility:** Avoid local-only storage hacks (such as local file databases or hardcoded local loopback addresses) so the application runs seamlessly when deployed to an AWS EC2 instance.

---

## 4. Documentation & Deliverables
* **Security Report (`futureSecurityFixes.md`):** Create a Markdown file in the repository documenting:
  * An acknowledgment of current security limitations and trade-offs.
  * Potential security hardening remedies for future iterations.
  * Explicit listing of the libraries and functions utilized for password hashing and token generation/session management.