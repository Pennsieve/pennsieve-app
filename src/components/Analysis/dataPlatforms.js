// The data platforms as the data pickers list them (platforms/: one module
// each), in one group, in their order.
import { PLATFORMS, PLATFORM_KEYS } from "./platforms";

export const DATA_PLATFORMS = PLATFORMS;

export const PLATFORM_GROUPS = [{ label: "Data platforms", keys: PLATFORM_KEYS }];

// The groups with only the platforms offered (keys), empty groups left out.
export const groupsOf = (offered) =>
  PLATFORM_GROUPS.map((g) => ({ ...g, keys: g.keys.filter((k) => offered.includes(k)) })).filter((g) => g.keys.length);

// "1,213 datasets", or "" before the count is known.
export const platformCount = (n, noun) => (Number.isFinite(n) ? `${n.toLocaleString("en-US")} ${noun}` : "");
