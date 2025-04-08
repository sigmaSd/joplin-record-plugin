# Joplin Audio Recorder Plugin

This plugin allows you to record audio directly within Joplin using your system's microphone. The recording is then saved as a resource (attachment) to the current note, and a Markdown link to the recording is inserted.

## Installation

1.  Go to the [GitHub Releases page](https://github.com/sigmasd/joplin-record-plugin/releases)
2.  Download the `io.sigmasd.record.jpl` file from the latest release assets.
3.  In Joplin, go to `Tools > Options > Plugins`.
4.  Click `Install plugin` and select the downloaded `.jpl` file.
5.  Restart Joplin if prompted.

## Usage

1.  **Install:** Download the `.jpl` file and install it in Joplin via `Tools > Options > Plugins`.
2.  **Select Note:** Open the Joplin note where you want to add the audio recording.
3.  **Start Recording:**
    *   Go to the `Tools` menu and click `Toggle Audio Recording`.
    *   Alternatively, press the keyboard shortcut `CmdOrCtrl+Alt+R`.
4.  **Grant Permissions:** If prompted by your system or Joplin, grant permission to access the microphone.
5.  **Recording Dialog:** A dialog box will appear with the message "🔴 Recording audio..." and a "Stop" button.
6.  **Stop Recording:**
    *   Click the "Stop" button in the dialog.
    *   Alternatively, use the menu item (`Tools > Toggle Audio Recording`) or the shortcut (`CmdOrCtrl+Alt+R`) again.
7.  **Processing:** The plugin will process the audio, save it as a Joplin resource, and insert a link into your note. The dialog will update to show "✅ Recording finished and inserted." or an error message.
8.  **Close Dialog:** Click "OK" on the final status dialog.

## Technical Notes

*   Relies on the standard Web `MediaRecorder` API available within Joplin's Electron environment.
*   Attempts to use the following MIME types in order of preference: `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/webm`, `audio/ogg`. The actual format used depends on your system's capabilities.
*   Temporary audio data is stored in `<Your OS Temporary Directory>/joplin-audio-recorder`. This directory is automatically cleaned up when Joplin exits or when the recording is successfully processed (or fails).
