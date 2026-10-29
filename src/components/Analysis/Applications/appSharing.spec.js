import { describe, it, expect } from "vitest";
import { entryType, makeNamer, accessEntries, accessSummary, shareCandidates, sharePayload, mergeMembers, emailToLookUp } from "./appSharing";

const profile = { id: "N:user:me", intId: 1, firstName: "Joost", lastName: "Wagenaar" };
const members = [
  { id: "N:user:ada", firstName: "Ada", lastName: "Lovelace", email: "ada@example.org" },
  { id: "N:user:alan", firstName: "Alan", lastName: "Turing", email: "alan@example.org" },
];
const teams = [{ team: { id: "N:team:seizure", name: "Seizure team" } }];
const organizations = [
  { organization: { id: "N:organization:sparc", name: "SPARC" } },
  { organization: { id: "N:organization:welcome", name: "Welcome" } },
];
const namer = makeNamer({ profile, members, teams, organizations });

describe("app sharing", () => {
  it("reads the API's entry shapes", () => {
    expect(entryType({ entityType: "organization" })).toBe("workspace");
    expect(entryType({ teamId: "t" })).toBe("team");
    expect(entryType({ userId: "u" })).toBe("user");
  });

  it("lists people, then teams, then workspaces, by name", () => {
    const entries = accessEntries(
      [
        { entityType: "workspace", entityRawId: "N:organization:sparc" },
        { entityType: "user", entityRawId: "N:user:me" },
        { entityType: "team", entityRawId: "N:team:seizure" },
        { entityType: "user", entityRawId: "N:user:ada" },
      ],
      namer,
      "N:organization:sparc"
    );
    expect(entries.map((e) => `${e.type}:${e.name}`)).toEqual([
      "user:Ada Lovelace",
      "user:Joost Wagenaar",
      "team:Seizure team",
      "workspace:SPARC",
    ]);
  });

  it("summarizes who else has access, not counting the owner", () => {
    const entries = [
      { type: "user", id: "N:user:me" },
      { type: "user", id: "N:user:ada" },
      { type: "team", id: "t" },
      { type: "workspace", id: "a" },
      { type: "workspace", id: "b" },
    ];
    expect(accessSummary(entries, "N:user:me")).toBe("Shared with 2 workspaces, 1 team and 1 person");
    expect(accessSummary([{ type: "user", id: "N:user:me" }], "N:user:me")).toBe("");
    expect(accessSummary([{ type: "team", id: "t" }], "x")).toBe("Shared with 1 team");
  });

  it("searches people, teams and workspaces at once, minus those already in", () => {
    const all = shareCandidates("", { members, teams, organizations }, [{ type: "user", id: "N:user:ada" }], "org");
    expect(all.map((c) => `${c.type}:${c.name}`)).toEqual(["user:Alan Turing", "team:Seizure team", "workspace:SPARC"]);
    expect(shareCandidates("ada@", { members }, []).map((c) => c.name)).toEqual(["Ada Lovelace"]);
    expect(shareCandidates("spa", { organizations }, []).map((c) => c.name)).toEqual(["SPARC"]);
  });

  it("saves visibility and access in one request, keeping the owner", () => {
    const payload = sharePayload(
      [
        { type: "user", id: "N:user:ada", organizationId: "o" },
        { type: "workspace", id: "N:organization:sparc" },
      ],
      "private",
      "N:user:me",
      "o"
    );
    expect(payload).toEqual({
      visibility: "private",
      users: [
        { entityId: "N:user:ada", organizationId: "o" },
        { entityId: "N:user:me", organizationId: "o" },
      ],
      teams: [],
      workspaces: [{ entityId: "N:organization:sparc", organizationId: "N:organization:sparc" }],
    });
  });

  it("offers people from all the caller's workspaces, once each, saying where from", () => {
    const merged = mergeMembers([
      { orgId: "o1", orgName: "SPARC", members: [members[0]] },
      { orgId: "o2", orgName: "Penn Neuro", members: [members[0], members[1]] },
    ]);
    expect(merged.map((m) => `${m.firstName}:${m.via.join("+")}:${m.viaOrgId}`)).toEqual(["Ada:SPARC+Penn Neuro:o1", "Alan:Penn Neuro:o2"]);
    const [ada] = shareCandidates("ada", { members: merged }, []);
    expect(ada.detail).toBe("ada@example.org · SPARC +1");
    expect(ada.allWorkspaces).toBe("SPARC, Penn Neuro");
    // Integration (service) accounts have no email: not offered.
    expect(shareCandidates("", { members: [{ id: "N:user:bot", firstName: "Integration", lastName: "User" }] }, [])).toEqual([]);
    expect(ada.organizationId).toBe("o1");
  });

  it("looks up a whole email address only, and only when no one in reach has it", () => {
    expect(emailToLookUp("grace@example.org", members)).toBe("grace@example.org");
    expect(emailToLookUp("ADA@example.org", members)).toBe("");
    expect(emailToLookUp("grace@", members)).toBe("");
    expect(emailToLookUp("grace", members)).toBe("");
    expect(emailToLookUp("grace@example.org", [], [{ type: "user", email: "grace@example.org" }])).toBe("");
  });
});
