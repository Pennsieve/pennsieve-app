import { describe, it, expect } from "vitest";
import { endingPhase, markSessionEnded, sessionEnded } from "./endedSessions";

describe("ended notebook sessions", () => {
  it("remembers a session ended in this tab", () => {
    expect(sessionEnded("run-1")).toBe(false);
    markSessionEnded("run-1");
    expect(sessionEnded("run-1")).toBe(true);
    expect(sessionEnded("")).toBe(false);
  });

  it("saves while the session step runs, finishes while later steps do, and is over with the run", () => {
    expect(endingPhase({ ended: true, runStatus: "STARTED", sessionStepStatus: "STARTED" })).toBe("saving");
    expect(endingPhase({ ended: true, runStatus: "STARTED", sessionStepStatus: undefined })).toBe("saving");
    expect(endingPhase({ ended: true, runStatus: "STARTED", sessionStepStatus: "SUCCEEDED" })).toBe("finishing");
    expect(endingPhase({ ended: true, runStatus: "SUCCEEDED", sessionStepStatus: "SUCCEEDED" })).toBeNull();
    expect(endingPhase({ ended: false, runStatus: "STARTED", sessionStepStatus: "STARTED" })).toBeNull();
  });
});
