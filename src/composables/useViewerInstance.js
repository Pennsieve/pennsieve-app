// @/composables/useViewerInstance.js
// Provides shared viewer instance management for the new tsviewer 1.1.0 factory pattern

import {
  createViewerStore,
  clearViewerStore,
  useViewerControls
} from '@pennsieve-viz/tsviewer'

// Shared instance ID for the primary viewer
// Using a constant ensures all components reference the same viewer instance
export const VIEWER_INSTANCE_ID = 'primary-viewer'

// Track whether the store has been initialized
let storeInitialized = false

/**
 * Initialize the viewer store for the given instance
 * Call this once when mounting the TSViewer component
 */
export function initViewerStore(instanceId = VIEWER_INSTANCE_ID) {
  storeInitialized = true
  return createViewerStore(instanceId)
}

/**
 * Clean up the viewer store when unmounting
 * Call this in onUnmounted lifecycle hook
 */
export function cleanupViewerStore(instanceId = VIEWER_INSTANCE_ID) {
  clearViewerStore(instanceId)
  storeInitialized = false
}

/**
 * Ensure the store is initialized before accessing controls
 * This handles the case where palette components mount before the viewer
 */
function ensureStoreInitialized(instanceId) {
  if (!storeInitialized) {
    createViewerStore(instanceId)
    storeInitialized = true
  }
}

/**
 * Composable to access viewer controls for the shared instance
 * Use this in palette components to interact with the viewer state
 *
 * Returns all controls from useViewerControls:
 * - Read-only state: channels, selectedChannels, annotations, activeTool, montageScheme, errors, viewer
 * - Channel controls: selectChannels, clearChannelSelection, toggleChannelVisibility, setChannelVisibility, showAllChannels, hideAllChannels
 * - Annotation controls: selectAnnotation, setActiveLayer, toggleLayerVisibility
 * - Other controls: setActiveTool, triggerRerender, reset, getState, store
 */
export function useViewerInstance(instanceId = VIEWER_INSTANCE_ID) {
  // Ensure store exists before accessing controls
  ensureStoreInitialized(instanceId)
  return useViewerControls(instanceId)
}
