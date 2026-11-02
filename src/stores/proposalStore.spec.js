import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";

vi.mock("@/site-config/site.json", () => ({ api2Url: "https://api2.test" }));
vi.mock("@/composables/useGetToken.js", () => ({ useGetToken: vi.fn(async () => "test-token") }));

import { useProposalStore } from "./proposalStore";

const publishingUrl = "https://api2.test/publishing";

const draftProposal = {
  nodeId: "N:proposal:1",
  userId: 42,
  name: "Mouse Cortex",
  description: "Two-photon imaging",
  organizationNodeId: "N:organization:sparc",
  proposalStatus: "DRAFT",
  survey: [{ questionId: 1, response: "Yes" }],
  contributors: [],
};

describe("proposal store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("loads proposals with the auth token and drops the deprecated contributors field", async () => {
    let authorizationHeader;
    server.use(
      http.get(`${publishingUrl}/proposal`, ({ request }) => {
        authorizationHeader = request.headers.get("Authorization");
        return HttpResponse.json([draftProposal]);
      })
    );
    const proposalStore = useProposalStore();

    await proposalStore.fetchProposals();

    expect(authorizationHeader).toBe("Bearer test-token");
    expect(proposalStore.datasetProposals).toHaveLength(1);
    expect(proposalStore.datasetProposals[0]).not.toHaveProperty("contributors");
  });

  it("treats a null proposal list as empty instead of failing", async () => {
    server.use(http.get(`${publishingUrl}/proposal`, () => HttpResponse.json(null)));
    const proposalStore = useProposalStore();

    await proposalStore.fetchProposals();

    expect(proposalStore.datasetProposals).toEqual([]);
    expect(proposalStore.proposalsError).toBe("");
  });

  it("sends only the fields the API reads on update, including nodeId and userId", async () => {
    let requestBody;
    server.use(
      http.put(`${publishingUrl}/proposal`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ...draftProposal, name: "Renamed" });
      })
    );
    const proposalStore = useProposalStore();
    proposalStore.datasetProposals = [draftProposal];

    await proposalStore.updateProposal({ ...draftProposal, name: "Renamed", status: "DRAFT" });

    expect(requestBody).toEqual({
      nodeId: "N:proposal:1",
      userId: 42,
      name: "Renamed",
      description: "Two-photon imaging",
      organizationNodeId: "N:organization:sparc",
      survey: [{ questionId: 1, response: "Yes" }],
    });
    expect(proposalStore.datasetProposals[0].name).toBe("Renamed");
  });

  it("removes a proposal even though DELETE returns an empty body", async () => {
    let deletedNodeId;
    server.use(
      http.delete(`${publishingUrl}/proposal`, ({ request }) => {
        deletedNodeId = new URL(request.url).searchParams.get("proposal_node_id");
        return new HttpResponse(null, { status: 200 });
      })
    );
    const proposalStore = useProposalStore();
    proposalStore.datasetProposals = [draftProposal];

    await proposalStore.removeProposal(draftProposal);

    expect(deletedNodeId).toBe("N:proposal:1");
    expect(proposalStore.datasetProposals).toEqual([]);
  });

  it("updates the proposal's status in the list after submit", async () => {
    let submittedNodeId;
    server.use(
      http.post(`${publishingUrl}/proposal/submit`, ({ request }) => {
        submittedNodeId = new URL(request.url).searchParams.get("node_id");
        return HttpResponse.json({ ...draftProposal, proposalStatus: "SUBMITTED" });
      })
    );
    const proposalStore = useProposalStore();
    proposalStore.datasetProposals = [draftProposal];

    const { result } = await proposalStore.submitProposal(draftProposal);

    expect(submittedNodeId).toBe("N:proposal:1");
    expect(result.proposalStatus).toBe("SUBMITTED");
    expect(proposalStore.datasetProposals[0].proposalStatus).toBe("SUBMITTED");
  });

  it("throws an error carrying the status code when the request fails", async () => {
    server.use(
      http.post(`${publishingUrl}/submission/accept`, () => new HttpResponse(null, { status: 400 }))
    );
    const proposalStore = useProposalStore();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(proposalStore.acceptProposal(draftProposal)).rejects.toMatchObject({ status: 400 });
  });
});
