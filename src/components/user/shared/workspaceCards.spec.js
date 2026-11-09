import { describe, it, expect } from "vitest";
import { memberWorkspaces, workspaceRole, sortWorkspaces, landingPath } from "./workspaceCards";

const ws = (id, name, over = {}) => ({ organization: { id, name }, ...over });

describe("workspace cards", () => {
  it("shows your workspaces as a member: no guest ones, no Welcome", () => {
    const list = [ws("a", "SPARC"), ws("b", "Welcome"), ws("c", "Guest", { isGuest: true }), ws("d", "Inner", { organization: { id: "d", name: "Inner", isGuest: true } })];
    expect(memberWorkspaces(list).map((w) => w.organization.name)).toEqual(["SPARC"]);
    expect(memberWorkspaces(null)).toEqual([]);
  });

  it("names your role", () => {
    expect(workspaceRole(ws("a", "A", { isOwner: true, isAdmin: true }))).toBe("Owner");
    expect(workspaceRole(ws("a", "A", { isAdmin: true }))).toBe("Admin");
    expect(workspaceRole(ws("a", "A"))).toBe("Member");
  });

  it("puts the one you last opened first, then by name", () => {
    const list = [ws("a", "beta"), ws("b", "Alpha"), ws("c", "Gamma")];
    expect(sortWorkspaces(list, "c").map((w) => w.organization.id)).toEqual(["c", "b", "a"]);
    expect(sortWorkspaces(list).map((w) => w.organization.id)).toEqual(["b", "a", "c"]);
  });

  it("lands on Datasets unless asked for Analysis", () => {
    expect(landingPath("N:organization:1", "analysis")).toBe("/N:organization:1/analysis");
    expect(landingPath("N:organization:1")).toBe("/N:organization:1/datasets");
    expect(landingPath("N:organization:1", "../x")).toBe("/N:organization:1/datasets");
  });
});
