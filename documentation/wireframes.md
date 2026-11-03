# UI & Layout Specification

## 1. Landing Page (`unnamed.png`)
- **Layout:** Single centered view designed as a public entry point.
- **Components:**
  - **Banner for the site:** A large header or hero container occupying the upper-to-middle section of the screen.
  - **Sign In Button:** A prominent pill-shaped or rounded button centered below the banner, directing users to authentication flows (Sign In / Sign Up).

## 2. Account Creation (`unnamed.png`)
- **Layout:** Centered modal-style or standalone form view.
- **Components:**
  - **Form Container:** A central box containing input fields for **Username and Password Setup**, paired with submission controls.

## 3. Lobbys / Lobby Dashboard (`unnamed.png`)
- **Layout:** Multi-panel dashboard with navigation options.
- **Components:**
  - **Main Room List Box:** A central container displaying available game rooms. Each item shows games with player counts and indicates whether the GM is present ("Shows if GM is there or not"). Text notes inside specify that it "Shows games only you can see."
  - **Filter / Search Utility:** Features a "Filter Rooms" dropdown and a connected search box allowing users to **Search by: Name, Player Count**.
  - **Footer Action:** An **Edit Character** button at the bottom center that navigates the user to the Character Customization view.

## 4. Character Customization (`unnamed.png`)
- **Layout:** Split-screen or sidebar navigation layout.
- **Components:**
  - **Left Sidebar / Navigation Menu:** Contains dropdowns/links for **Rooms** and **Characters / YourChar**.
  - **Main Form Area:**
    - **Character Name:** Input field at the top.
    - **Character Information:** Large text area for descriptive background or custom text.
    - **Character Token:** A dedicated boxed container in the upper right for uploading/displaying the character image token.
    - **Link to Notes:** Navigation anchor linking the user directly to their saved notes page.

## 5. Game Room Player View (`unnamed. (1).png`)
- **Layout:** Two-column split layout (Left: Whiteboard; Right: Sidebar tools).
- **Components:**
  - **Left Panel (Whiteboard):** Large interactive canvas area for shared visual elements.
  - **Right Sidebar (Stacked Layout):**
    - **Player List and Status:** Top right box displaying active players and their statuses. Includes a helper text: *"Edit character button next to your character takes you to character customization"*.
    - **Passing Notes System:** Middle/bottom right box dedicated to in-game note passing. Contains instructional text: *"Share by clicking share then player name in list"*, an icon button to **View notes**, and a submit action labeled *"Save by clicking save and its added to the notes page"* with a corresponding save icon button.

## 6. View Notes (`unnamed. (1).png`)
- **Layout:** Two-column split layout.
- **Components:**
  - **Left Sidebar (Notes Navigator):** 
    - Top search bar labeled **Search Notes**.
    - Hierarchical tree or list view containing navigation dropdowns (**Games**, **Notes**, and individual items like **note1**).
  - **Right Panel (Note Contents):** Large reading and editing text pane displaying the body of the currently selected note.

## 7. Game Room GM View (`unnamed. (1).png`)
- **Layout:** Two-column split layout (Mirrors the Player View structure).
- **Components:**
  - **Left Panel (Whiteboard):** Large interactive canvas area.
  - **Right Sidebar:**
    - **Player List and Status:** Upper box featuring a **`+` (Plus)** action button in the top right to add players or manage room roster.
    - **Drawing Tools:** Lower right box containing toolsets for GM canvas manipulation.

## 8. Game Room Settings (`unnamed. (1).png`)
- **Layout:** Sidebar navigation paired with a detailed configuration canvas.
- **Components:**
  - **Left Sidebar:** Simple list/navigation pillar labeled **Players**.
  - **Main Content Area:**
    - **Selected Player's Character Information:** Displays structured character metadata. Includes a linked action / annotation pointing to a **View notes, shows non-passed notes** option.
    - **Character Token:** Dedicated square image display box in the upper right of the settings pane.