/**
 * Model Colors Utility
 * Provides a consistent color palette for differentiating models in visualizations
 * Colors are designed to work well with the application's theme
 */

// 20 distinct color pairs (background and border) for models
export const modelColors = [
  // Purple shades
  { name: 'purple', background: '#f3f0ff', border: '#8b5cf6' },
  { name: 'indigo', background: '#eef2ff', border: '#6366f1' },
  { name: 'navy', background: '#e8eaf5', border: '#3b4d7a' },
  
  // Blue shades
  { name: 'blue', background: '#eff6ff', border: '#3b82f6' },
  { name: 'sky', background: '#e0f2fe', border: '#0ea5e9' },
  { name: 'cyan', background: '#e6f8f7', border: '#08b3af' },
  
  // Green shades
  { name: 'green', background: '#f0f9ff', border: '#10b981' },
  { name: 'emerald', background: '#ecfdf5', border: '#059669' },
  { name: 'lime', background: '#f7fee7', border: '#65a30d' },
  
  // Yellow/Orange shades
  { name: 'yellow', background: '#fffbeb', border: '#f59e0b' },
  { name: 'amber', background: '#fff7ed', border: '#f97316' },
  { name: 'orange', background: '#fef6eb', border: '#ea580c' },
  
  // Red/Pink shades
  { name: 'red', background: '#fef2f2', border: '#ef4444' },
  { name: 'rose', background: '#fff1f2', border: '#f43f5e' },
  { name: 'pink', background: '#fdf2f8', border: '#ec4899' },
  { name: 'fuchsia', background: '#fdf4ff', border: '#d946ef' },
  
  // Additional unique colors
  { name: 'violet', background: '#f5f3ff', border: '#9333ea' },
  { name: 'slate', background: '#f8fafc', border: '#64748b' },
  { name: 'teal', background: '#f0fdfa', border: '#14b8a6' },
  { name: 'bronze', background: '#fef3e2', border: '#b45309' }
];

// Special color for packages/files
export const packageColor = { 
  name: 'gray', 
  background: '#f9fafb', 
  border: '#6b7280' 
};

// Map for quick lookup
export const modelColorMap = Object.fromEntries(
  modelColors.map(color => [color.name, color])
);

/**
 * Get a consistent color for a model based on its ID
 * Uses a hash function to ensure the same model always gets the same color
 * @param {string} modelId - The unique identifier of the model
 * @returns {Object} Color object with background and border colors
 */
export function getModelColor(modelId) {
  if (!modelId) return packageColor;
  
  // Create a simple hash of the model ID
  let hash = 0;
  for (let i = 0; i < modelId.length; i++) {
    const char = modelId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash to select a color consistently
  const colorIndex = Math.abs(hash) % modelColors.length;
  return modelColors[colorIndex];
}

/**
 * Get color by index (useful for legends or sequential coloring)
 * @param {number} index - The index of the color to retrieve
 * @returns {Object} Color object with background and border colors
 */
export function getModelColorByIndex(index) {
  if (index < 0 || index >= modelColors.length) {
    return modelColors[0]; // Default to first color if out of bounds
  }
  return modelColors[index];
}

/**
 * Get all available model colors
 * @returns {Array} Array of all model color objects
 */
export function getAllModelColors() {
  return [...modelColors];
}

/**
 * Create a color assignment map for a list of models
 * Ensures each model gets a unique color if possible
 * @param {Array} modelIds - Array of model IDs
 * @returns {Map} Map of modelId to color object
 */
export function createModelColorAssignment(modelIds) {
  const colorAssignment = new Map();
  const usedColors = new Set();
  
  modelIds.forEach((modelId, index) => {
    // Try to use sequential colors first for better visual distinction
    if (index < modelColors.length) {
      colorAssignment.set(modelId, modelColors[index]);
      usedColors.add(index);
    } else {
      // Fall back to hash-based assignment if we have more models than colors
      const color = getModelColor(modelId);
      colorAssignment.set(modelId, color);
    }
  });
  
  return colorAssignment;
}

export default {
  modelColors,
  packageColor,
  modelColorMap,
  getModelColor,
  getModelColorByIndex,
  getAllModelColors,
  createModelColorAssignment
};