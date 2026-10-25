import { describe, it, expect } from "vitest";
import {
  parseAwsAccountInput,
  checkAccountInput,
  iamRoleConsoleUrl,
  stackConsoleUrl,
  connectionState,
  errorMessage,
} from "./awsConnect";

describe("parseAwsAccountInput", () => {
  it("takes an account ID as typed or as the console shows it", () => {
    expect(parseAwsAccountInput("123456789012")).toEqual({ accountId: "123456789012", roleName: null });
    expect(parseAwsAccountInput(" 1234-5678-9012 ")).toEqual({ accountId: "123456789012", roleName: null });
    expect(parseAwsAccountInput("1234 5678 9012")).toEqual({ accountId: "123456789012", roleName: null });
  });

  it("takes a role's ARN, with or without a path", () => {
    expect(parseAwsAccountInput("arn:aws:iam::123456789012:role/Pennsieve-Compute-dev-1a2b3c4d")).toEqual({
      accountId: "123456789012",
      roleName: "Pennsieve-Compute-dev-1a2b3c4d",
    });
    expect(parseAwsAccountInput("arn:aws:iam::123456789012:role/team/Pennsieve-Compute-dev-1a")).toEqual({
      accountId: "123456789012",
      roleName: "Pennsieve-Compute-dev-1a",
    });
  });

  it("says what's wrong otherwise", () => {
    expect(parseAwsAccountInput("").error).toMatch(/Enter/);
    expect(parseAwsAccountInput("12345").error).toMatch(/12 digits/);
    expect(parseAwsAccountInput("arn:aws:s3:::bucket").error).toMatch(/role's ARN/);
  });
});

describe("checkAccountInput", () => {
  it("requires a pasted ARN to name the role this setup made", () => {
    expect(checkAccountInput("arn:aws:iam::123456789012:role/Other", "Pennsieve-Compute-dev-1a").error).toMatch(/Other/);
    expect(checkAccountInput("arn:aws:iam::123456789012:role/Pennsieve-Compute-dev-1a", "Pennsieve-Compute-dev-1a").accountId).toBe("123456789012");
    expect(checkAccountInput("123456789012", "Pennsieve-Compute-dev-1a").accountId).toBe("123456789012");
  });
});

describe("console links", () => {
  it("open the role and the stack", () => {
    expect(iamRoleConsoleUrl("ROLE-x")).toBe("https://console.aws.amazon.com/iam/home#/roles/details/ROLE-x");
    expect(stackConsoleUrl("Pennsieve-Compute-dev-1a")).toContain("region=us-east-1#/stacks?filteringText=Pennsieve-Compute-dev-1a");
  });
});

describe("connectionState", () => {
  it("calls an account without a template an older connection", () => {
    expect(connectionState({})).toEqual({ kind: "legacy", label: "Older connection" });
    expect(connectionState({ connection: "legacy" }).kind).toBe("legacy");
  });

  it("says when a newer template is out", () => {
    expect(connectionState({ connection: "cloudformation", templateVersion: 1, latestTemplateVersion: 2 }).kind).toBe("outdated");
    expect(connectionState({ connection: "cloudformation", templateVersion: 2, latestTemplateVersion: 2 }).kind).toBe("current");
    expect(connectionState({ connection: "cloudformation", templateVersion: 1 }).kind).toBe("current");
  });
});

describe("errorMessage", () => {
  it("shows the server's message, else one for the status", () => {
    expect(errorMessage(400, { message: "Pennsieve couldn't use the role" })).toBe("Pennsieve couldn't use the role");
    expect(errorMessage(400, { error: "bad" })).toBe("bad");
    expect(errorMessage(422, null)).toMatch(/already connected/);
    expect(errorMessage(503, {})).toMatch(/Pennsieve's side/);
  });
});
