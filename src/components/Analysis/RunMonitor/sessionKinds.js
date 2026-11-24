// The kinds of live session a run's interactive step can be (its app.yml's
// runtime.sessionType), and what the run pages do and say for each:
//   jupyter  a notebook, opened in Pennsieve's own notebook page
//   webapp   a web page the app serves itself, opened in a new browser tab
import { isFeatureEnabled } from "@/utils/features";

// The kinds and a run's session step come from @pennsieve/notebooks; the
// run pages' rules and words for each kind are the app's.
import { NOTEBOOK, WEBAPP, isNotebookSession, sessionKind } from "@pennsieve/notebooks/components/Analysis/RunMonitor/sessionKinds";
export { NOTEBOOK, WEBAPP, isNotebookSession, sessionKind };
export { sessionStep } from "@pennsieve/notebooks/components/Analysis/RunMonitor/sessionKinds";

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

// Hands this tab over to a web app session. The token goes to the session's
// auth proxy in a form post, never in an address, where the browser's
// history, a request log or the app's own page could read it. The proxy keeps
// it in a cookie the app's pages can't read and sends the tab on to the app.
export function openWebAppSession({ kernelUrl, token }, doc = document) {
  const form = doc.createElement("form");
  form.method = "post";
  form.action = `${kernelUrl.replace(/\/+$/, "")}/pennsieve/open`;
  const field = doc.createElement("input");
  field.type = "hidden";
  field.name = "token";
  field.value = token;
  form.appendChild(field);
  doc.body.appendChild(form);
  form.submit();
}
