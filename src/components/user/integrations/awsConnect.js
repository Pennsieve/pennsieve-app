// Connecting an AWS account in the browser: Pennsieve issues a role setup
// (a role name and the external ID the role will require), the user creates
// the role from Pennsieve's CloudFormation template in their own AWS console
// (only in the account they named first), and Pennsieve verifies it. Pure, so
// the rules are easy to test.

const ACCOUNT_ID = /^\d{12}$/;
// arn:aws:iam::123456789012:role/Name, or role/path/Name
const ROLE_ARN = /^arn:aws[a-z-]*:iam::(\d{12}):role\/(?:[\w+=,.@-]+\/)*([\w+=,.@-]+)$/;
// Any other ARN that names an account: the stack's own, the first one the
// console shows (arn:aws:cloudformation:us-east-1:123456789012:stack/…).
const ANY_ARN = /^arn:aws[a-z-]*:[a-z0-9-]+:[a-z0-9-]*:(\d{12}):/;

// The account the user is connecting: a 12-digit account ID (spaces and
// dashes allowed, as the console shows it: 1234-5678-9012), the role's ARN
// from the stack's Outputs, or any ARN in the account (the stack's).
// { accountId, roleName } or { error }.
export function parseAwsAccountInput(input) {
  const text = (input || "").trim();
  if (!text) return { error: "Enter your AWS account ID." };
  const arn = text.match(ROLE_ARN);
  if (arn) return { accountId: arn[1], roleName: arn[2] };
  const other = text.match(ANY_ARN);
  if (other) return { accountId: other[1], roleName: null };
  if (text.startsWith("arn:")) return { error: "That ARN doesn't name an AWS account. Enter the 12-digit account ID." };
  const digits = text.replace(/[\s-]/g, "");
  if (ACCOUNT_ID.test(digits)) return { accountId: digits, roleName: null };
  return { error: "An AWS account ID is 12 digits." };
}

export const iamRoleConsoleUrl = (roleName) =>
  `https://console.aws.amazon.com/iam/home#/roles/details/${encodeURIComponent(roleName)}`;

// The stack in the CloudFormation console, found by its name (the role's).
export const stackConsoleUrl = (stackName, region = "us-east-1") =>
  `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks?filteringText=${encodeURIComponent(stackName)}&filteringStatus=active&viewNested=true`;

// What to delete in AWS once an account is disconnected: Pennsieve can't
// delete the role itself (its policy denies changing Pennsieve-Compute-*
// roles). A role made from the template belongs to its stack, so the stack
// goes; an older role the agent made goes on its own. Null without a role.
export function roleCleanup(account) {
  const name = account?.roleName;
  if (!name) return null;
  if (account.connection === "cloudformation") {
    return { kind: "stack", name, url: stackConsoleUrl(name) };
  }
  return { kind: "role", name, url: iamRoleConsoleUrl(name) };
}

// How an account is connected, for its badge: made from Pennsieve's template
// ("cloudformation", up to date or with a newer template to update to), or an
// older role the agent made, without a template ("legacy", the default when
// the record doesn't say).
export function connectionState(account) {
  if (!account) return null;
  if (account.connection !== "cloudformation") {
    return { kind: "legacy", label: "Older connection" };
  }
  const have = Number(account.templateVersion);
  const latest = Number(account.latestTemplateVersion);
  if (have && latest && have < latest) {
    return { kind: "outdated", label: "Update available" };
  }
  return { kind: "current", label: "" };
}

// The message to show for a failed call: the server's ({ message } or
// { error }), else one for its status.
export function errorMessage(status, body) {
  const fromServer = body && (body.message || body.error);
  if (typeof fromServer === "string" && fromServer.trim()) return fromServer.trim();
  if (status === 404) return "Pennsieve couldn't find that. Try again in a minute.";
  if (status === 409 || status === 422) return "This AWS account is already connected.";
  if (status >= 500) return "Something went wrong on Pennsieve's side. Try again in a moment.";
  return "That didn't work. Check the account ID and try again.";
}
