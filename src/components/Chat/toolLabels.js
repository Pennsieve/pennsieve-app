// Friendly labels for chat-backend tool names (spec §5).
// New tools fall back to "Running <name>…" so the UI doesn't break when
// the backend ships a tool the frontend doesn't know yet.

export const TOOL_LABELS = {
  summarize_workspace: 'Pulling workspace overview…',
  list_datasets: 'Listing your datasets…',
  list_workspace_members: 'Looking up workspace members…',
  summarize_dataset: 'Reading dataset metadata…',
  review_files: 'Listing files…',
  preview_file: 'Previewing file…',
  list_dataset_collaborators: 'Looking up collaborators…',
  search_discover_datasets: 'Searching Pennsieve Discover…',
  get_discover_dataset: 'Loading published dataset details…',
  lookup_citation: 'Resolving citation…',
}

export const labelForTool = (name) => {
  if (TOOL_LABELS[name]) return TOOL_LABELS[name]
  return `Running ${name}…`
}
