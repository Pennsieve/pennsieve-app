/*
  Notebook sessions the user just ended. Ending one closes the kernel, but the
  run carries on for a while: the session step saves the notebook and its
  output/ files, its task stops, and the workflow's next steps run. Until the
  run finishes its page says so, instead of "Running" with End and Open
  still offered. Remembered for the tab (sessionStorage, a convenience) and
  in memory, since ending in the notebook leads straight to the run's page.
*/
import { reactive } from "vue";
import { isTerminalStatus } from "./runHelpers";

const KEY = "pennsieve.endedSessions";

const load = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};

const ended = reactive(load());

export function markSessionEnded(runId) {
  if (!runId) return;
  ended[runId] = Date.now();
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ended));
  } catch {
    // remembered in memory only
  }
}

export function sessionEnded(runId) {
  return !!runId && !!ended[runId];
}

/*
  Where an ended session's run is: "saving" while the session step is still
  going (it saves the notebook and output/ before its task stops),
  "finishing" while later steps run, null once the run is over or the session
  wasn't ended here.
*/
export function endingPhase({ ended: wasEnded, runStatus, sessionStepStatus }) {
  if (!wasEnded || isTerminalStatus(runStatus)) return null;
  return isTerminalStatus(sessionStepStatus) ? "finishing" : "saving";
}
