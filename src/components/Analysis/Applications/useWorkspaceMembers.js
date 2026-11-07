// The members of every workspace the caller is in, merged (mergeMembers),
// loaded once per workspace and shared across the app page and its Share
// dialog: people can be shared with from any of them, and named wherever
// they come from.
import { ref } from "vue";
import { useStore } from "vuex";
import { useGetToken } from "@/composables/useGetToken";
import { mergeMembers } from "./appSharing";

const membersByOrg = new Map();
const allMembers = ref([]);

export function useWorkspaceMembers() {
  const store = useStore();

  const load = async () => {
    const orgs = (store.state.organizations || [])
      .map((o) => o?.organization)
      .filter((o) => o?.id && o.name?.toLowerCase() !== "welcome");
    const missing = orgs.filter((o) => !membersByOrg.has(o.id));
    if (missing.length) {
      const token = await useGetToken();
      await Promise.all(
        missing.map(async (o) => {
          try {
            const resp = await fetch(`${store.state.config.apiUrl}/organizations/${encodeURIComponent(o.id)}/members?api_key=${token}`);
            membersByOrg.set(o.id, resp.ok ? await resp.json() : []);
          } catch {
            membersByOrg.set(o.id, []);
          }
        })
      );
    }
    allMembers.value = mergeMembers(orgs.map((o) => ({ orgId: o.id, orgName: o.name, members: membersByOrg.get(o.id) || [] })));
  };

  return { allMembers, load };
}
