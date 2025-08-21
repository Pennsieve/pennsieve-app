// WebGLScatterplot.vue
<template>
  <div class="scatterplot-container" ref="containerRef">
    <canvas ref="canvasRef"></canvas>
    <div id="tooltip" ref="tooltipRef"></div>
    <div v-show="false" id="debug" ref="debugRef"></div>
  </div>
</template>

<script setup lang="ts" >
import { ref, onMounted, onBeforeUnmount, watch, nextTick, defineEmits } from 'vue';
import * as d3 from 'd3';

const emit = defineEmits([
  'updateColorMap'
]);

const pointSize = 5

// Props
const props = defineProps({
  pointCount: {
    type: Number,
    default: 5000
  },
  colorMode: {
    type: String,
    default: 'random',
    validator: (value) => ['random', 'gradient', 'single', 'species', 'sex'].includes(value)
  },
  startColor: {
    type: String,
    default: '#ff0000'
  },
  endColor: {
    type: String,
    default: '#0000ff'
  },
  singleColor: {
    type: String,
    default: '#4285f4'
  },
  forceRegenerate: {
    type: Boolean,
    default: false
  },
  data: {
    type: Array,
    default: []
  },
  metaData: {
    type: Object,
    default: {}
  },
  colorMap: {
    type: Map,
    default: new Map()
  }
});

// Watch for window resize
function handleResize() {
  if (!containerRef.value || !canvasRef.value || !gl) return;
  
  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;
  
  canvasRef.value.width = width;
  canvasRef.value.height = height;
  
  gl.viewport(0, 0, width, height);
  drawScatterplot(gl, programInfo, transform, pointSize, highlightedPoint);
}

// Watch for force regenerate flag
watch(() => props.forceRegenerate, () => {
  if (gl && program) {
    // Regenerate data
    data = generateData(
      props.pointCount, 
      props.colorMode, 
      props.startColor, 
      props.endColor, 
      props.singleColor
    );
    
    // Update buffers
    if (programInfo) {
      gl.deleteBuffer(programInfo.positionBuffer);
      gl.deleteBuffer(programInfo.colorBuffer);
    }
    
    programInfo = prepareBuffers(gl, program, data);
    
    // Reset transform
    transform = d3.zoomIdentity;
    // transform['x'] = props.data

    if (canvasRef.value && zoom) {
      d3.select(canvasRef.value).call(zoom.transform, transform);
    }
    
    // Redraw
    drawScatterplot(gl, programInfo, transform, pointSize, null);
  }
});

watch( () => props.data, () => {
  console.log('Seeing data changed')
  initVisualization();
})

// Lifecycle hooks
onMounted(() => {
  console.log('Component mounted');
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  // Clean up event listeners
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('mousemove', handleMouseMove);
    canvasRef.value.removeEventListener('mouseleave', handleMouseLeave);
  }
  window.removeEventListener('resize', handleResize);
  
  // Clean up WebGL resources
  if (gl && programInfo) {
    gl.deleteBuffer(programInfo.positionBuffer);
    gl.deleteBuffer(programInfo.colorBuffer);
    if (program) gl.deleteProgram(program);
  }
});

// Template refs
const containerRef = ref(null);
const canvasRef = ref(null);
const tooltipRef = ref(null);
const debugRef = ref(null);

// State variables
let gl = null;
let program = null;
let data = [];
let programInfo = null;
let transform = null;
let zoom = null;
let highlightedPoint = null;
let width = 0;
let height = 0;

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  try {
    // Ensure the hex string is properly formatted
    if (!hex || hex.length < 7) {
      console.warn(`Invalid hex color: ${hex}, using fallback`);
      return [1.0, 0.0, 0.0]; // Default to red
    }

    // Extract RGB components and normalize to 0-1 range for WebGL
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    // Ensure values are valid numbers
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn(`Invalid hex color components in: ${hex}, using fallback`);
      return [1.0, 0.0, 0.0]; // Default to red
    }

    return [r, g, b];
  } catch (err) {
    console.error('Error converting hex to RGB:', err);
    return [1.0, 0.0, 0.0]; // Default to red
  }
}

// Linear interpolation between two values
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Utility functions //

// Helper function to convert screen coordinates to data coordinates
function screenToData(screenX, screenY, transform, width, height) {

  if (!transform) return { x: 0, y: 0 };

  // Convert to clip space
  const clipX = (screenX / width) * 2 ;
  const clipY = -((screenY / height) * 2 );

  // Apply inverse transform

  const stat1 = props.metaData.row_groups[0].columns[0].meta_data.statistics
  const dataScaleFactor = 2/(stat1.max_value-stat1.min_value) ;

  const translateX = (transform.x / width * 2) -1;
  const translateY = (-transform.y / height * 2) +1;

  const scale = transform.k * dataScaleFactor;
  const x = (clipX - translateX -1 ) / scale ;
  const y = (clipY - translateY +1 ) / scale ;

  return { x, y };
}

// Find nearest point to the mouse cursor
function findNearestPoint(data, mouseX, mouseY, transform, width, height) {
  if (!data.length || !transform) return null;

  const debugEl = debugRef.value;

  // Get data coordinates from screen coordinates
  const dataPoint = screenToData(mouseX, mouseY, transform, width, height);

  if (debugEl) {
    debugEl.innerHTML = `
      Mouse: (${mouseX.toFixed(1)}, ${mouseY.toFixed(1)})<br>
      Data: (${dataPoint.x.toFixed(2)}, ${dataPoint.y.toFixed(2)})<br>
      Scale: ${transform.k.toFixed(2)}
    `;
  }

  // Find the nearest point in data space
  let minDist = Infinity;
  let nearestPoint = null;

  for (const point of data) {
    const dx = point.x - dataPoint.x;
    const dy = point.y - dataPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Adjust threshold based on zoom level
    // Allow easier selection when zoomed out
    const threshold = 3 / (transform.k / 2);

    if (dist < minDist && dist < threshold) {

      minDist = dist;
      nearestPoint = point;
    }
  }

  if (nearestPoint && debugEl) {
    debugEl.innerHTML += `<br>Nearest: (${nearestPoint.x.toFixed(2)}, ${nearestPoint.y.toFixed(2)})`;
  }

  return nearestPoint;
}

function generateData(count, colorMode, startColor, endColor, singleColor) {
  console.log(`Generating ${count} data points with color mode: ${colorMode}`);

  const data = [];

  // Convert hex colors to RGB arrays
  const startRGB = hexToRgb(startColor);
  const endRGB = hexToRgb(endColor);
  const singleRGB = hexToRgb(singleColor);

  const hexColors = ["#4269d0","#efb118","#ff725c","#6cc5b0","#3ca951","#ff8ab7","#a463f2","#97bbf5","#9c6b4e","#9498a0"]
  const rgbColors = hexColors.map(color => hexToRgb(color))

  const colorMap = new Map();

// Add key-value pairs
  for (let i = 0; i < props.data.length; i++) {

    const x = props.data[i][0]
    const y = props.data[i][1]

    // Generate a value to display in the tooltip
    const value = Math.round(Math.sqrt(x * x + y * y) * 10) / 10;

    // cellType color
    let cellTypeColor = colorMap.get(props.data[i][5]);
    if (cellTypeColor == null) {
      colorMap.set(props.data[i][5], rgbColors[i%rgbColors.length])
    }


    // Assign random categorical variables
    // const speciesValue = species[Math.floor(Math.random() * species.length)];
    // const sexValue = sexes[Math.floor(Math.random() * sexes.length)];

    // For the first 7 points, use test colors to verify shader correctness
    let color;
    switch (colorMode) {
      case 'random':
        color = [Math.random(), Math.random(), Math.random()];
        break;

      case 'gradient':
        // Use position as factor for gradient (normalized to 0-1)
        const factor = (x + 50) / 100;
        color = [
          lerp(startRGB[0], endRGB[0], factor),
          lerp(startRGB[1], endRGB[1], factor),
          lerp(startRGB[2], endRGB[2], factor)
        ];
        break;

      case 'single':
        color = [...singleRGB];
        break;

      // case 'species':
      //   color = [...speciesColors[speciesValue]];
      //   break;

      case 'Type':
        color = [...colorMap.get(props.data[i][5])];
        break;

      default:
        color = [Math.random(), Math.random(), Math.random()];switch (colorMode) {
        case 'random':
          color = [Math.random(), Math.random(), Math.random()];
          break;

        case 'gradient':
          // Use position as factor for gradient (normalized to 0-1)
          const factor = (x + 50) / 100;
          color = [
            lerp(startRGB[0], endRGB[0], factor),
            lerp(startRGB[1], endRGB[1], factor),
            lerp(startRGB[2], endRGB[2], factor)
          ];
          break;

        case 'single':
          color = [...singleRGB];
          break;

        // case 'species':
        //   color = [...speciesColors[speciesValue]];
        //   break;

        case 'Type':
          color = [...colorMap.get(props.data[i][5])];
          break;

        default:
          color = [Math.random(), Math.random(), Math.random()];
      }
    }

    data.push({
      x,
      y,
      rawX: x,
      rawY: y,
      color,
      id: i,
      value: value,
      label: ``,
      category: value < 25 ? 'Near' : value < 50 ? 'Medium' : 'Far'
    });
  }
  return data;
}



// WebGL setup and rendering functions //

// Initialize WebGL context
function initWebGL(canvas) {
  if (!canvas) {
    console.error('Canvas element not provided to initWebGL');
    return null;
  }

  // Try with different context attributes to maximize compatibility
  const contextAttributes = {
    preserveDrawingBuffer: true,
    antialias: true,
    alpha: true
  };

  // Try to get context with various names (for older browsers)
  let gl = null;
  try {
    // Try standard WebGL context first
    gl = canvas.getContext('webgl', contextAttributes) ||
      canvas.getContext('experimental-webgl', contextAttributes);

    if (!gl) {
      console.error('WebGL not supported in this browser');
      return null;
    }

    // Configure WebGL settings for better rendering
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Explicitly disable depth testing since we're in 2D
    gl.disable(gl.DEPTH_TEST);

    return gl;
  } catch (e) {
    console.error('Error initializing WebGL context:', e);
    return null;
  }
}

// Create shader program
function createShaderProgram(gl, vsSource, fsSource) {
  if (!gl) return null;

  try {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vsSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(vertexShader);
      console.error('Could not compile vertex shader:', info);
      return null;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fsSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(fragmentShader);
      console.error('Could not compile fragment shader:', info);
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      console.error('Could not link shader program:', info);
      return null;
    }

    // Validate program (additional check)
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
      console.error('Program validation failed:', gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  } catch (err) {
    console.error('Error creating shader program:', err);
    return null;
  }
}

// Prepare buffer data
function prepareBuffers(gl, program, data) {
  if (!gl || !program || !data.length) {
    console.error('Missing required parameters for buffer preparation');
    return null;
  }

  try {
    // Create position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array(data.flatMap(d => [d.x, d.y]));
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Create color buffer
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    const colors = new Float32Array(data.flatMap(d => d.color));
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    // Get attribute locations
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const colorAttributeLocation = gl.getAttribLocation(program, 'a_color');

    // Check if attribute locations were found
    if (positionAttributeLocation === -1 || colorAttributeLocation === -1) {
      console.error('Failed to get attribute locations', {
        positionAttributeLocation,
        colorAttributeLocation
      });
      return null;
    }

    // Get uniform locations
    const viewMatrixLocation = gl.getUniformLocation(program, 'u_viewMatrix');
    const pointSizeLocation = gl.getUniformLocation(program, 'u_pointSize');

    // Check if uniform locations were found
    if (!viewMatrixLocation || !pointSizeLocation) {
      console.error('Failed to get uniform locations', {
        viewMatrixLocation,
        pointSizeLocation
      });
      return null;
    }

    return {
      program,
      positionBuffer,
      colorBuffer,
      positionAttributeLocation,
      colorAttributeLocation,
      viewMatrixLocation,
      pointSizeLocation,
      count: data.length
    };
  } catch (err) {
    console.error('Error preparing buffers:', err);
    return null;
  }
}

// Draw the scatterplot
function drawScatterplot(gl, programInfo, transform, pointSize, highlightedPoint = null) {
  if (!gl || !programInfo || !transform) {
    console.warn('Missing required parameters for drawing', { gl, programInfo, transform });
    return;
  }


  try {
    const {
      program,
      positionBuffer,
      colorBuffer,
      positionAttributeLocation,
      colorAttributeLocation,
      viewMatrixLocation,
      pointSizeLocation,
      count
    } = programInfo;

    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use the shader program
    gl.useProgram(program);

    // Enable attributes
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(colorAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    // Compute view matrix from transformation
    const width = gl.canvas.clientWidth;
    const height = gl.canvas.clientHeight;

    // Scale factor to map our data range (-50 to 50) to WebGL's (-1 to 1)
    const stat1 = props.metaData.row_groups[0].columns[0].meta_data.statistics
    // const dataScaleFactor = 2/(stat1.max_value-stat1.min_value);
    const dataScaleFactor = 1;

    // Calculate final translation that keeps center point centered during zoom
    // const translateX = (transform.x / width * 2) -1;
    // const translateY = (-transform.y / height * 2) +1;

    const translateX = 0;
    const translateY = 0;

    const matrix = new Float32Array([
      transform.k * dataScaleFactor, 0, 0, 0,
      0, transform.k * dataScaleFactor, 0, 0,
      0, 0, 1, 0,
      translateX, translateY, 0, 1
    ]);

    // Set uniforms
    gl.uniformMatrix4fv(viewMatrixLocation, false, matrix);
    gl.uniform1f(pointSizeLocation, pointSize * Math.sqrt(transform.k));

    // Enable blending for anti-aliased points
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw points
    gl.drawArrays(gl.POINTS, 0, count);

    // If we have a highlighted point, draw it separately with a larger size
    if (highlightedPoint !== null) {
      // Create a buffer for the highlighted point
      const highlightBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, highlightBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([highlightedPoint.x, highlightedPoint.y]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

      // Create a buffer for the highlight color (white)
      const highlightColorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, highlightColorBuffer);
      // Use a bright yellow-white color for the highlight
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1.0, 1.0, 0.5]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, false, 0, 0);

      // Draw the highlighted point with a larger size
      gl.uniform1f(pointSizeLocation, pointSize * Math.sqrt(transform.k) * 2.5);
      gl.drawArrays(gl.POINTS, 0, 1);

      // Draw an outline halo around the highlighted point
      const outlineColorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, outlineColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1.0, 0.8, 0.2]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, false, 0, 0);

      gl.uniform1f(pointSizeLocation, pointSize * Math.sqrt(transform.k) * 3.0);
      gl.drawArrays(gl.POINTS, 0, 1);

      // Clean up temporary buffers
      gl.deleteBuffer(highlightBuffer);
      gl.deleteBuffer(highlightColorBuffer);
      gl.deleteBuffer(outlineColorBuffer);
    }
  } catch (err) {
    console.error('Error drawing scatterplot:', err);
  }
}

// Function to update colors based on color mode
function updateColors() {
  if (!gl || !programInfo || !data.length) return;

  let valueIndex = 0
  for (let i in props.metaData.schema) {
    if (props.metaData.schema[i].name === props.colorMode) {
      valueIndex = i - 1
    }
  }

  // Update colors based on selected mode
  const colors = new Float32Array(props.data.flatMap(d => {

    return props.colorMap.get(d[valueIndex])
  }));

  // Update buffer
  gl.deleteBuffer(programInfo.colorBuffer);
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

  // Update program info
  programInfo.colorBuffer = colorBuffer;

  // Redraw
  drawScatterplot(gl, programInfo, transform, pointSize, highlightedPoint);
}

// Initialize the visualization
function initVisualization() {
  if (!canvasRef.value || !containerRef.value) {
    console.warn('Canvas or container refs not available yet');
    return;
  }

  // Get canvas dimensions
  width = containerRef.value.clientWidth || 800
  height = containerRef.value.clientHeight || 400

  // Set canvas size
  canvasRef.value.width = width;
  canvasRef.value.height = height;

  // Initialize WebGL
  gl = initWebGL(canvasRef.value);

  if (!gl) {
    console.error('Failed to initialize WebGL');
    return;
  }

  // Create shader program
  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec3 a_color;
    uniform mat4 u_viewMatrix;
    uniform float u_pointSize;
    varying vec3 v_color;

    void main() {
      // Pass color to fragment shader
      v_color = a_color;
      // Set point size
      gl_PointSize = u_pointSize;
      // Transform position
      gl_Position = u_viewMatrix * vec4(a_position, 0, 1);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    varying vec3 v_color;

    void main() {
      // Calculate distance from center of point
      float dist = length(gl_PointCoord.xy - vec2(0.5, 0.5));

      // Discard fragments outside the circle
      if (dist > 0.5) discard;

      // Add a subtle glow effect at the edges
      float alpha = 1.0;
      if (dist > 0.4) {
        alpha = 1.0 - (dist - 0.4) * 2.0; // Fade out from 0.4 to 0.5
      }

      // Output final color with computed alpha
      gl_FragColor = vec4(v_color, alpha);
    }
  `;

  program = createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);

  if (!program) {
    console.error('Failed to create shader program');
    return;
  }

  // Use the program right after creation as a verification step
  gl.useProgram(program);

  // Generate data
  data = generateData(
    props.pointCount,
    props.colorMode,
    props.startColor,
    props.endColor,
    props.singleColor
  );

  // Prepare buffers
  programInfo = prepareBuffers(gl, program, data);

  if (!programInfo) {
    console.error('Failed to prepare buffers');
    return;
  }

  // Set up zoom behavior
  transform = d3.zoomIdentity;
  const stat1 = props.metaData.row_groups[0].columns[0].meta_data.statistics
  // const dataScaleFactor = 2/(stat1.max_value-stat1.min_value);

  const dataScaleFactor = 1;

  // transform['k'] = 0.8
  // transform['x'] = ((stat1.max_value - stat1.min_value)/2)/dataScaleFactor+ width/2
  // const stat2 = props.metaData.row_groups[0].columns[1].meta_data.statistics
  // transform['y'] = -((stat2.max_value - stat2.min_value)/2) + height/2

  // Create the zoom behavior
  zoom = d3.zoom()
    .scaleExtent([0.1, 15])
    .on('zoom', (event) => {
      transform = event.transform;

      drawScatterplot(gl, programInfo, transform, pointSize, highlightedPoint);

      // Update debug info
      if (debugRef.value) {
        const mousePoint = d3.pointer(event, canvasRef.value);
        if (mousePoint && mousePoint.length === 2) {
          const dataPoint = screenToData(mousePoint[0], mousePoint[1], transform, width, height);
          debugRef.value.innerHTML = `
            Scale: ${transform.k.toFixed(2)}<br>
            Translation: (${transform.x.toFixed(0)}, ${transform.y.toFixed(0)})<br>
            Data at cursor: (${dataPoint.x.toFixed(2)}, ${dataPoint.y.toFixed(2)})
          `;
        }
      }
    });

  // Apply zoom to canvas
  d3.select(canvasRef.value).call(zoom);

  // Initial draw with delay to ensure everything is set up
  setTimeout(() => {
    try {
      drawScatterplot(gl, programInfo, transform, pointSize, null);
    } catch (err) {
      console.error('Error during initial draw:', err);
    }
  }, 50);

  // Add event listeners
  setupEventListeners();
}

// Set up event listeners
function setupEventListeners() {
  if (!canvasRef.value || !tooltipRef.value) return;

  // Mouse move event for tooltip and highlighting
  canvasRef.value.addEventListener('mousemove', handleMouseMove);

  // Mouse leave event
  canvasRef.value.addEventListener('mouseleave', handleMouseLeave);
}

// Mouse move handler
function handleMouseMove(event) {
  if (!canvasRef.value || !tooltipRef.value) return;

  // Get mouse position relative to canvas
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const point = findNearestPoint(data, mouseX, mouseY, transform, width, height);

  if (point) {
    // Show tooltip with categorical information
    const tooltip = tooltipRef.value;
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY - 15) + 'px';
    tooltip.style.opacity = 1;
    tooltip.innerHTML = `
      <strong>${point.label}</strong><br>
      Species: ${point.species}<br>
      Distance: ${point.value.toFixed(2)}<br>
      Category: ${point.category}
    `;

    // Update the highlighted point and redraw
    highlightedPoint = point;
    drawScatterplot(gl, programInfo, transform, pointSize, highlightedPoint);
  } else {
    // Hide tooltip
    if (tooltipRef.value) {
      tooltipRef.value.style.opacity = 0;
    }

    // Clear highlighted point if there was one
    if (highlightedPoint !== null) {
      highlightedPoint = null;
      drawScatterplot(gl, programInfo, transform, pointSize, null);
    }
  }
}

// Mouse leave handler
function handleMouseLeave() {
  if (!tooltipRef.value) return;

  // Hide tooltip
  tooltipRef.value.style.opacity = 0;

  // Clear highlighted point when mouse leaves canvas
  if (highlightedPoint !== null) {
    highlightedPoint = null;
    drawScatterplot(gl, programInfo, transform, pointSize, null);
  }
}

// Watch for changes to props and update visualization accordingly
watch(() => props.colorMode, (newMode, oldMode) => {
  if (!gl || !programInfo) {
    console.warn('WebGL not initialized yet');
    return;
  }

  updateColors();

});

// Watch for changes to color values
watch([() => props.startColor, () => props.endColor, () => props.singleColor], () => {
  if (props.colorMode !== 'species' && props.colorMode !== 'sex') {
    // Regenerate data with new colors
    data = generateData(
      props.pointCount,
      props.colorMode,
      props.startColor,
      props.endColor,
      props.singleColor
    );

    // Update buffers
    if (gl && programInfo) {
      gl.deleteBuffer(programInfo.colorBuffer);
      const colorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      const colors = new Float32Array(data.flatMap(d => d.color));
      gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

      // Update program info
      programInfo.colorBuffer = colorBuffer;

      // Redraw
      drawScatterplot(gl, programInfo, transform, pointSize, highlightedPoint);
    }
  }
});

// Watch for changes to point count
watch(() => props.pointCount, (newCount) => {
  // Only regenerate when point count changes significantly
  if (Math.abs(newCount - data.length) > 10) {
    // Regenerate data with new count
    data = generateData(
      newCount,
      props.colorMode,
      props.startColor,
      props.endColor,
      props.singleColor
    );

    // Update buffers
    if (gl && program) {
      if (programInfo) {
        gl.deleteBuffer(programInfo.positionBuffer);
        gl.deleteBuffer(programInfo.colorBuffer);
      }

      programInfo = prepareBuffers(gl, program, data);

      // Redraw
      drawScatterplot(gl, programInfo, transform, pointSize, null);
    }
  }
});
</script>

<style scoped>
.scatterplot-container {
  width: 100%;
  height: 100%;
  min-width: 800px;
  position: relative;
  background-color: #f0f0f0;
}

canvas {
  display: block;
  cursor: crosshair;
  width: 100%;
  height: 100%;
}

#tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: pointSize;
  white-space: nowrap;
}

#debug {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.8);
  padding: 10px;
  border-radius: 5px;
  font-family: monospace;
}
</style>

