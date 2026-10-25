// Connecting an AWS account in the browser: Pennsieve issues a role setup
// (a role name and the external ID the role will require), the user creates
// the role from Pennsieve's CloudFormation template in their own AWS console,
// then gives back their account ID for Pennsieve to verify. Pure, so the
// rules are easy to test.

const ACCOUNT_ID = /^\d{12}$/;
// arn:aws:iam::123456789012:role/Name, or role/path/Name
const ROLE_ARN = /^arn:aws[a-z-]*:iam::(\d{12}):role\/(?:[\w+=,.@-]+\/)*([\w+=,.@-]+)$/;

// What the user typed in the Verify step: a 12-digit account ID (spaces and
// dashes allowed, as the console shows it: 1234-5678-9012) or the role's ARN
// from the stack's Outputs. { accountId, roleName } or { error }.
export function parseAwsAccountInput(input) {
  const text = (input || "").trim();
  if (!text) return { error: "Enter your AWS account ID." };
  const arn = text.match(ROLE_ARN);
  if (arn) return { accountId: arn[1], roleName: arn[2] };
  if (text.startsWith("arn:")) return { error: "That isn't a role's ARN (arn:aws:iam::<account>:role/<name>)." };
  const digits = text.replace(/[\s-]/g, "");
  if (ACCOUNT_ID.test(digits)) return { accountId: digits, roleName: null };
  return { error: "An AWS account ID is 12 digits." };
}

// The parsed input, checked against the role Pennsieve set up: a pasted ARN
// must name that role.
export function checkAccountInput(input, expectedRoleName) {
  const parsed = parseAwsAccountInput(input);
  if (parsed.error) return parsed;
  if (parsed.roleName && expectedRoleName && parsed.roleName !== expectedRoleName) {
    return { error: `That ARN is for role ${parsed.roleName}; this setup created ${expectedRoleName}.` };
  }
  return parsed;
}

export const iamRoleConsoleUrl = (roleName) =>
  `https://console.aws.amazon.com/iam/home#/roles/details/${encodeURIComponent(roleName)}`;

// The stack in the CloudFormation console, found by its name (the role's).
export const stackConsoleUrl = (stackName, region = "us-east-1") =>
  `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks?filteringText=${encodeURIComponent(stackName)}&filteringStatus=active&viewNested=true`;

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
