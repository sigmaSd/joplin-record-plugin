# Joplin Archive Plugin

This plugin for Joplin allows you to archive completed to-dos (checked checkboxes) from any note to a dedicated "TODO Archive" notebook. It helps keep your notes clean and focused on active tasks, while preserving a record of completed items.

## Features

-   **Archives Completed To-dos:** Moves checked to-dos (`- [x]` or `- [X]`) from the current note to a separate note within the "TODO Archive" notebook.
-   **Creates Archive Notebook:** If a "TODO Archive" notebook doesn't exist, the plugin automatically creates it.
-   **Preserves Original Note Structure:**  Keeps other lines, such as headers and regular text, in their original positions within both the archived note and the updated original note.  This is crucial for maintaining the context of your notes.
-   **Date-Stamped Archive Notes:** Creates a new archive note for each day, named with the original note's title and the current date (YYYY-MM-DD format).  For example, "Meeting Notes - 2024-01-27".
-   **Updates Original Note:** Removes the archived (checked) to-dos from the original note, leaving only unchecked to-dos and other content.
-   **Multiple Invocation Methods:**
    -   **Context Menu:** Right-click on a note in the note list and select "Archive Selected Note".
    -   **Tools Menu:** Access the command from the "Tools" menu.
    -   **Keyboard Shortcut:** Use the shortcut `CmdOrCtrl+Shift+A`.
    -  **Top Level Menu**: "Archive" -> "Archive Selected Note"

## Installation

1.  **Automatic Installation (Recommended):**
    -   Open Joplin.
    -   Go to Tools > Options > Plugins.
    -   Search for "Archive".
    -   Click "Install" and restart Joplin.

2.  **Manual Installation:**
    -   Download the latest `.jpl` file from the [Releases](https://github.com/sigmasd/joplin-archive-plugin/releases) page.
    -   Open Joplin.
    -   Go to Tools > Options > Plugins.
    -   Click the gear icon next to "Manage your plugins" and select "Install from file".
    -   Select the downloaded `.jpl` file.
    -   Restart Joplin.

## Usage

1.  **Select a note:** In Joplin, select the note containing the completed to-dos you want to archive.
2.  **Invoke the command:** Use any of the following methods:
    -   **Context Menu:** Right-click on the note in the note list and select "Archive Selected Note".
    -   **Tools Menu:** Go to Tools > Archive Selected Note.
    -   **Keyboard Shortcut:** Press `CmdOrCtrl+Shift+A`.
    -   **Top Level Menu**:  "Archive" -> "Archive Selected Note".
3.  **Confirmation:** The plugin will display a message confirming the archive operation and the name of the newly created archive note.

The completed to-dos will be moved to a new note within the "TODO Archive" notebook, and the original note will be updated to remove the archived items.

## How it Works

1.  **Gets the Note:** The plugin retrieves the selected note's content (title, body, and parent ID).
2.  **Splits into Lines:** The note body is split into individual lines.
3.  **Separates Checked/Unchecked:** The lines are categorized into checked to-dos, unchecked to-dos, and other content.  Critically, *all* lines (including headers and regular text) are preserved and kept in their original relative order in both the archived and the original note.
4.  **Finds/Creates "TODO Archive":** The plugin searches for a notebook named "TODO Archive". If it doesn't exist, it creates one.
5.  **Creates Archive Note:** A new note is created in the "TODO Archive" notebook. The title of the archive note includes the original note's title and the current date. The body of the archive note contains the checked to-dos and other content, maintaining the original order.
6.  **Updates Original Note:** The original note's body is updated to contain only the unchecked to-dos and other content, again preserving the original order.

## Development

To build the plugin:

1.  Clone the repository:
    ```bash
    git clone https://github.com/sigmasd/joplin-archive-plugin.git
    cd joplin-archive-plugin
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3. Build the plugin
    ```bash
    npm run dist
    ```
4.  The plugin file (`io.sigmasd.jopline-archive.jpl`) will be created in the `dist` folder. You can then install it manually in Joplin as described above.

For more detailed development information, refer to the Joplin [plugin API documentation](https://joplinapp.org/api/get_started/plugins/).

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License
