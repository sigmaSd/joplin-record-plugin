import joplin from 'api';
import { MenuItemLocation, ViewHandle, ButtonSpec } from 'api/types'; // Added ViewHandle, ButtonSpec
import * as moment from 'moment';
import * as os from 'os';
import * as path from 'path';

// --- Plugin State ---
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording: boolean = false;
let currentStream: MediaStream | null = null;
let recordingDialogHandle: ViewHandle | null = null;

// --- Native Modules ---
let fs: any = null;

// --- Constants ---
const TEMP_DIR_NAME = 'joplin-audio-recorder';
let TEMP_DIR = '';

// --- Helper Functions ---

async function ensureTempDirExists() {
  if (!fs) {
    console.error("fs-extra not loaded yet!");
    return;
  }
  await fs.ensureDir(TEMP_DIR);
}

async function cleanupTempDir() {
  if (!fs) return;
  try {
    if (await fs.pathExists(TEMP_DIR)) {
      await fs.remove(TEMP_DIR);
      console.log('Cleaned up temporary directory:', TEMP_DIR);
    }
  } catch (error) {
    console.error('Error cleaning up temporary directory:', error);
  }
}

// --- Dialog Handling (Revised with Stop Button) ---

async function createRecordingDialog(): Promise<void> {
  if (recordingDialogHandle) return;
  try {
    recordingDialogHandle = await joplin.views.dialogs.create('audioRecorderStatusDialog');
    await joplin.views.dialogs.setHtml(recordingDialogHandle, '<p style="padding: 1em;">Initializing...</p>');
    await joplin.views.dialogs.setButtons(recordingDialogHandle, []); // Start with no buttons
    await joplin.views.dialogs.setFitToContent(recordingDialogHandle, true);
    console.log("Recording dialog created successfully.");
  } catch (error) {
    console.error("Failed to create recording dialog:", error);
    recordingDialogHandle = null; // Ensure handle is null on failure
    alert("Error creating recorder status dialog. Plugin UI might not work correctly.");
  }
}

// enum DialogState { Idle, Recording, Finished, Error } // Optional state enum

async function updateDialog(message: string, buttons: ButtonSpec[]): Promise<void> {
  if (!recordingDialogHandle) {
    console.warn("updateDialog called but dialog handle is null.");
    await createRecordingDialog(); // Attempt to recreate if missing
    if (!recordingDialogHandle) return; // Still failed
  }

  try {
    await joplin.views.dialogs.setHtml(recordingDialogHandle, `<div style="padding: 1em;">${message}</div>`);
    await joplin.views.dialogs.setButtons(recordingDialogHandle, buttons);

    // Re-open or ensure it's visible. The promise handles button clicks.
    // We only care about the 'stop' button click here. 'ok' just closes it.
    joplin.views.dialogs.open(recordingDialogHandle).then(result => {
      console.log("Recording dialog resolved:", result);
      if (result && result.id === 'stop') {
        console.log("Stop button clicked in dialog.");
        // Don't await here, let it run in background
        stopRecording();
      } else if (result && result.id === 'ok') {
        console.log("OK button clicked in dialog.");
        // Dialog closes automatically, nothing specific needed here.
      }
    }).catch(error => {
      // Ignore errors like "Dialog was closed." or if already open/closed manually
      if (error && error.message && (error.message.includes('Dialog was closed') || error.message.includes('Another dialog is already open'))) {
        console.debug("Dialog open promise rejected (expected closure or already open):", error.message);
      } else {
        console.error("Recording dialog open promise rejected:", error);
      }
    });
  } catch (error) {
    console.error("Failed to update or open dialog:", error);
    // Fallback alert if dialog fails catastrophically
    if (buttons.find(b => b.id === 'ok')) { // If it was supposed to be a final state
      alert(`Recording finished/error, but dialog failed: ${message}`);
    }
  }
}


// --- Core Recording Logic ---

async function startRecording() {
  if (isRecording) {
    console.warn('Recording already in progress.');
    return;
  }
  if (!fs) {
    alert("Plugin error: File system module not loaded.");
    return;
  }
  // Ensure dialog exists before trying to use it
  if (!recordingDialogHandle) {
    await createRecordingDialog();
    if (!recordingDialogHandle) { // Check if creation failed
      alert("Failed to initialize recorder UI. Cannot start recording.");
      return;
    }
  }

  console.log('Attempting to start recording...');
  try {
    // 1. Request Microphone Access
    currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('Microphone access granted.');

    // 2. Create MediaRecorder instance
    const mimeTypesToTry = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg'];
    let usedMimeType: string | null = null;
    let recorderOptions: { mimeType?: string } = {};

    for (const mimeType of mimeTypesToTry) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Trying supported MIME type: ${mimeType}`);
        recorderOptions.mimeType = mimeType;
        try {
          mediaRecorder = new MediaRecorder(currentStream, recorderOptions);
          usedMimeType = mimeType;
          break; // Success!
        } catch (e) {
          console.warn(`Initialization with ${mimeType} failed, trying next.`, e);
          mediaRecorder = null; // Reset for next attempt
        }
      } else {
        console.log(`MIME type not supported: ${mimeType}`);
      }
    }

    // Fallback if specific types failed
    if (!mediaRecorder) {
      console.log("Trying default MediaRecorder initialization...");
      try {
        mediaRecorder = new MediaRecorder(currentStream);
        usedMimeType = mediaRecorder.mimeType || 'audio/unknown';
      } catch (e) {
        console.error("Default MediaRecorder initialization failed:", e);
        alert(`Error initializing recorder: ${e.message || e}`);
        currentStream?.getTracks().forEach(track => track.stop());
        currentStream = null;
        await updateDialog(`⚠️ Error initializing recorder: ${e.message || e}`, [{ id: 'ok', title: 'OK' }]);
        return;
      }
    }


    console.log('Using MIME type:', usedMimeType);
    const fileExtension = usedMimeType.split('/')[1]?.split(';')[0] || 'bin';

    // 3. Reset state and setup event listeners
    audioChunks = [];
    isRecording = true;

    // Show status *before* starting recorder logic, include Stop button
    await updateDialog("🔴 Recording audio...", [{ id: 'stop', title: 'Stop' }]);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        console.log(`Audio chunk received: ${event.data.size} bytes`);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('Recording stopped. Processing audio data...');
      const finalMimeType = usedMimeType; // Capture mime type at stop time
      const finalFileExtension = fileExtension; // Capture extension

      const cleanupStream = () => {
        currentStream?.getTracks().forEach(track => track.stop());
        currentStream = null;
        console.log('Microphone stream stopped.');
      };

      if (audioChunks.length === 0) {
        console.warn('No audio data recorded.');
        cleanupStream();
        alert('No audio data was recorded.');
        await updateDialog('⚠️ No audio data recorded.', [{ id: 'ok', title: 'OK' }]);
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: finalMimeType });
      console.log(`Audio Blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      audioChunks = []; // Clear chunks array early

      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const fileName = `recording_${timestamp}.${finalFileExtension}`;

      await ensureTempDirExists();
      const tempFilePath = path.join(TEMP_DIR, fileName);

      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(tempFilePath, buffer);
        console.log('Temporary audio file saved:', tempFilePath);

        console.log('Creating Joplin resource...');
        const resource = await joplin.data.post(
          ['resources'],
          null,
          { title: fileName, mime: finalMimeType }, // Explicitly set mime type
          [{ path: tempFilePath }]
        );
        console.log('Joplin resource created:', resource.id, 'with MIME type:', finalMimeType);

        const markdownLink = `[${fileName}](:/${resource.id})`; // Standard link
        await joplin.commands.execute('insertText', markdownLink);
        console.log('Markdown link inserted into note.');

        await updateDialog('✅ Recording finished and inserted.', [{ id: 'ok', title: 'OK' }]);

      } catch (error) {
        console.error('Error processing or inserting recording:', error);
        alert(`Failed to save or insert recording: ${error.message}`);
        await updateDialog(`⚠️ Error processing recording: ${error.message}`, [{ id: 'ok', title: 'OK' }]);
      } finally {
        cleanupStream();
        try {
          if (await fs.pathExists(tempFilePath)) {
            await fs.unlink(tempFilePath);
            console.log('Temporary file deleted:', tempFilePath);
          }
        } catch (cleanupError) {
          console.warn(`Could not delete temp file: ${tempFilePath}`, cleanupError);
        }
      }
    };

    mediaRecorder.onerror = async (event) => {
      console.error('MediaRecorder error:', event);
      const error = (event as ErrorEvent)?.error; // Try to get specific error
      const errorMessage = error?.message || 'Unknown recording error';
      alert(`Recording error: ${errorMessage}`);
      await updateDialog(`⚠️ Recording Error: ${errorMessage}`, [{ id: 'ok', title: 'OK' }]);

      // Force cleanup
      isRecording = false;
      currentStream?.getTracks().forEach(track => track.stop());
      currentStream = null;
      audioChunks = [];
      mediaRecorder = null;
    };

    // Start recording (after setup and UI update)
    mediaRecorder.start(); // Default timeslice
    console.log('Recording started.');

  } catch (err) {
    console.error('Error accessing microphone or starting recorder:', err);
    isRecording = false; // Ensure state is reset
    mediaRecorder = null;
    currentStream?.getTracks().forEach(track => track.stop());
    currentStream = null;

    const userMessage = (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      ? 'Microphone access was denied. Please allow access in your browser/system settings.'
      : (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')
        ? 'No microphone found. Please ensure a microphone is connected and enabled.'
        : `Error starting recording: ${err.message || err}`;

    alert(userMessage);
    // Update dialog if it exists
    if (recordingDialogHandle) {
      await updateDialog(`⚠️ Error: ${userMessage}`, [{ id: 'ok', title: 'OK' }]);
    }
  }
}

async function stopRecording() {
  // Only proceed if actually recording
  if (!isRecording || !mediaRecorder) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      console.warn('stopRecording called but recorder state is:', mediaRecorder.state);
      // Attempt to force stop anyway if state is inconsistent
    } else {
      console.warn('Stop recording called but not recording or recorder not initialized.');
      return;
    }
  }

  // Prevent double-stopping
  if (mediaRecorder && mediaRecorder.state === 'inactive') {
    console.warn("Stop recording called, but recorder is already inactive.");
    // Ensure UI is updated if state got messed up
    if (isRecording) { // If state mismatch
      isRecording = false;
      await updateDialog('⚪ Recording stopped (state mismatch).', [{ id: 'ok', title: 'OK' }]);
    }
    return;
  }

  console.log('Attempting to stop recording...');
  isRecording = false; // Update state immediately

  try {
    // The 'onstop' handler will be triggered asynchronously by this call
    mediaRecorder.stop();
    // UI update (to Finished/Error) happens within onstop/onerror
    console.log("MediaRecorder stop() called.");
  } catch (error) {
    console.error("Error calling MediaRecorder.stop():", error);
    alert(`Error stopping recording: ${error.message}`);
    // Force cleanup and update UI if stop() call itself fails
    isRecording = false; // Redundant but safe
    currentStream?.getTracks().forEach(track => track.stop());
    currentStream = null;
    audioChunks = [];
    mediaRecorder = null;
    if (recordingDialogHandle) {
      await updateDialog(`⚠️ Error stopping recorder: ${error.message}`, [{ id: 'ok', title: 'OK' }]);
    }
  }
}

// --- Command and Menu Item ---

const COMMAND_NAME = 'toggleAudioRecording';
const MENU_ITEM_ID = 'audioRecToolsMenuItem';
const MENU_ITEM_LABEL = 'Toggle Audio Recording';

// --- Plugin Registration ---

joplin.plugins.register({
  onStart: async function () {
    console.log('Audio Recorder Plugin starting...');

    try {
      fs = joplin.require('fs-extra');
    } catch (e) {
      console.error("Failed to load fs-extra:", e);
      alert("Audio Recorder Plugin Error: Could not load required file system module.");
      return;
    }

    TEMP_DIR = path.join(os.tmpdir(), TEMP_DIR_NAME);
    await ensureTempDirExists();
    await createRecordingDialog(); // Create dialog structure immediately

    await joplin.commands.register({
      name: COMMAND_NAME,
      label: MENU_ITEM_LABEL,
      iconName: 'fas fa-microphone',
      execute: async () => {
        // Basic check if already recording to prevent rapid toggling issues
        if (isRecording) {
          // If user clicks command while recording, treat as stop request
          console.log("Toggle command executed while recording - stopping.");
          await stopRecording();
        } else {
          // If not recording, start
          console.log("Toggle command executed while not recording - starting.");
          // Optional: Add a small delay to prevent accidental double-clicks?
          // await new Promise(resolve => setTimeout(resolve, 150));
          // if (isRecording) return; // Check again after delay
          await startRecording();
        }
      },
    });

    await joplin.views.menuItems.create(
      MENU_ITEM_ID,
      COMMAND_NAME,
      MenuItemLocation.Tools,
      { accelerator: 'CmdOrCtrl+Alt+R' }
    );

    console.log('Audio Recorder Plugin started successfully!');

    // Optional: Cleanup on exit
    process.on('exit', cleanupTempDir);
    process.on('SIGINT', cleanupTempDir);
    process.on('SIGTERM', cleanupTempDir);
  },
});
