# Checkpoint 3: Room System and Room Management

## Objective
Establish the core multiplayer room architecture, enabling users with the GM role to create private game rooms, generate secure join codes, and manage player access to their game sessions.

---

## 1. Database Schema (`GameRoom` Table)
Extend the backend database to support game room creation, GM ownership, and unique room identification:

### `GameRoom` Table
| Column Name | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto-increment |
| `roomname` | `VARCHAR` | Not Null (Name of the game room) |
| `GM` | `INTEGER` | Foreign Key referencing `Accounts(id)`, Not Null (Denotes GM role ownership) |
| `roomCode` | `CHAR(8)` | Unique, Not Null, Indexed (Secure unique code for players to join) |

*(Note: Depending on how your room-to-player mapping is handled in this phase, ensure player access or room membership references are supported via room association keys or junction logic.)*

---

## 2. Frontend & User Flow Requirements
- **Lobby Dashboard:**
  * Displays a searchable list of game rooms the authenticated user currently has access to.
  * Provides sorting options by player count or alphabetically by room name.
- **Game Room Creation Form (GM Role):**
  * Collects the desired room name from the user.
  * Automatically assigns the creator the **GM** role for that room and generates a unique 8-character `roomCode`.
- **Room Entry / Joining:**
  * Allows players to input the unique `roomCode` provided by the GM to gain access to the private game room lobby.
- **Game Room Settings Form (GM View):**
  * Allows GMs to manage which players are allowed or active within the room.
  * Provides administrative controls for GMs to remove players or delete their game rooms entirely.

---

## 3. Backend & Room Management Logic
- **GM Role Verification:**
  * Protect room configuration and administrative endpoints by verifying that the requesting user's account ID matches the `GM` foreign key on the target `GameRoom` record.
- **Room Code Generation & Validation:**
  * Implement backend logic to automatically generate secure, non-colliding 8-character `roomCode` strings upon room creation.
  * Validate submitted room codes during the player join flow to securely attach or grant access to the room.

---

## 4. Production Readiness & Scalability (AWS EC2)
- **Database Indexing for Lookups:** 
  * Add an explicit index on `GameRoom.roomCode` and `GameRoom.GM` to ensure rapid room-lookup speeds as players frequently join rooms concurrently on the EC2 instance.
- **Stateless Session & Routing:**
  * Ensure room validation and session checks remain stateless, allowing horizontal scaling or load-balancing across multiple backend processes on AWS EC2 without losing room state sync.
- **Environment & Configuration Isolation:**
  * Keep all database connection strings, server port configurations, and application secrets strictly isolated via environment variables (`.env` or system environment variables).

---

## 5. Documentation & Deliverables
- **Room System Architecture Report (`roomSystemNotes.md`):** Create a Markdown file in the repository documenting:
  * An overview of the GM permission hierarchy and room creation workflow.
  * API endpoint definitions for room creation, code validation, and player management.
  * Handling of edge cases such as duplicate room code generation or unauthorized room access attempts.