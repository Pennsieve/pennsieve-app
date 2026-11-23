// The kinds of live session a run's interactive step can be (its app.yml's
// runtime.sessionType), and what the run pages do and say for each:
//   jupyter  a notebook, opened in Pennsieve's own notebook page
//   webapp   a web page the app serves itself, opened in a new browser tab
import { isFeatureEnabled } from "@/utils/features";

export const NOTEBOOK = "jupyter";
export const WEBAPP = "webapp";

// A run's interactive step: the DAG node whose app declares a live session,
// or null.
export const sessionStep = (dag = []) =>
  (dag || []).find((d) => d.runtimeConfig?.interactive || d.interactive) || null;

// The step's kind. A session without a type is a notebook, as the platform
// reads it.
export const sessionKind = (step) => step?.runtimeConfig?.sessionType || step?.sessionType || NOTEBOOK;

export const isNotebookSession = (step) => sessionKind(step) === NOTEBOOK;

// Web app sessions are behind the webAppSessions site flag. With it off, a
// web app step gets no Open or End on the run pages; cancel the run to stop it.
export const sessionAllowed = (step) => isNotebookSession(step) || isFeatureEnabled("webAppSessions");

// Whether the run page offers a session's Open and End. A notebook's are
// offered for as long as the run is active: its page waits for the kernel
// itself. A web app's only while its step is running: until then the steps
// before it are, and there is nothing to open or end.
export function sessionOffered(step, { runActive, stepStatus }) {
  if (!step || !runActive || !sessionAllowed(step)) return false;
  return isNotebookSession(step) || stepStatus === "STARTED";
}

// What the run pages call a session of each kind.
const WORDS = {
  [NOTEBOOK]: {
    open: "Open Notebook",
    openTitle: "Interactive notebook is waiting for you — open it",
    endTitle: "End session — resumes the workflow",
    endBody:
      "Ending the session shuts down the notebook kernel and resumes the workflow at the next step. Any unsaved notebook changes will be lost — open the notebook first if you need to save your work.",
    saving:
      "Session ended. Saving the notebook and its output files; the workflow continues once they're saved. This can take a few minutes.",
    finishing: "Session ended and saved. Running the rest of the workflow…",
  },
  [WEBAPP]: {
    open: "Open App",
    openTitle: "This step is waiting for you — open its app",
    endTitle: "End session — closes the app",
    endBody:
      "Ending the session closes the app without finishing in it. The app decides what the workflow does next: a step that was waiting for your decision usually fails. To continue the workflow, open the app and finish there.",
    saving: "Session ended. Saving the step's output files. This can take a few minutes.",
    finishing: "Session ended and saved. Running the rest of the workflow…",
  },
};

export const sessionWords = (step) => WORDS[sessionKind(step)] || WORDS[WEBAPP];

// The address a web app session's tab opens: the session's own host with its
// token. The session's auth proxy moves the token into a cookie on that first
// request, so the app's pages and forms need nothing else.
export function webAppSessionUrl({ kernelUrl, token }) {
  return `${kernelUrl.replace(/\/+$/, "")}/?token=${encodeURIComponent(token)}`;
}
