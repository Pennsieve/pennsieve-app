import { ref } from 'vue'

// Force-directed layout simulation
export const useLayout = () => {
  const layoutOptions = {
    Force: 'Force-directed',
    Hierarchical: 'Hierarchical',
    Circular: 'Circular',
    Grid: 'Grid'
  }

  // Force-directed layout using simple physics simulation
  const applyForceLayout = (nodes, edges, iterations = 100) => {
    const repulsionForce = 100000
    const attractionForce = 0.1
    const damping = 0.9
    
    // Initialize velocities
    nodes.forEach(node => {
      node.velocity = { x: 0, y: 0 }
    })
    
    for (let iter = 0; iter < iterations; iter++) {
      // Reset forces
      nodes.forEach(node => {
        node.force = { x: 0, y: 0 }
      })
      
      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeA = nodes[i]
          const nodeB = nodes[j]
          
          const dx = nodeB.position.x - nodeA.position.x
          const dy = nodeB.position.y - nodeA.position.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1
          
          const force = repulsionForce / (distance * distance)
          const fx = (dx / distance) * force
          const fy = (dy / distance) * force
          
          nodeA.force.x -= fx
          nodeA.force.y -= fy
          nodeB.force.x += fx
          nodeB.force.y += fy
        }
      }
      
      // Attraction along edges
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        
        if (sourceNode && targetNode) {
          const dx = targetNode.position.x - sourceNode.position.x
          const dy = targetNode.position.y - sourceNode.position.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1
          
          const force = distance * attractionForce
          const fx = (dx / distance) * force
          const fy = (dy / distance) * force
          
          sourceNode.force.x += fx
          sourceNode.force.y += fy
          targetNode.force.x -= fx
          targetNode.force.y -= fy
        }
      })
      
      // Update positions
      nodes.forEach(node => {
        node.velocity.x = (node.velocity.x + node.force.x) * damping
        node.velocity.y = (node.velocity.y + node.force.y) * damping
        
        node.position.x += node.velocity.x
        node.position.y += node.velocity.y
      })
    }
    
    // Clean up temporary properties
    nodes.forEach(node => {
      delete node.velocity
      delete node.force
    })
  }

  // Hierarchical layout
  const applyHierarchicalLayout = (nodes, edges) => {
    // Find root nodes (nodes with no incoming edges)
    const incomingEdges = new Map()
    nodes.forEach(node => incomingEdges.set(node.id, []))
    
    edges.forEach(edge => {
      if (incomingEdges.has(edge.target)) {
        incomingEdges.get(edge.target).push(edge)
      }
    })
    
    const rootNodes = nodes.filter(node => incomingEdges.get(node.id).length === 0)
    const levels = new Map()
    
    // BFS to assign levels
    const queue = rootNodes.map(node => ({ node, level: 0 }))
    const visited = new Set()
    
    while (queue.length > 0) {
      const { node, level } = queue.shift()
      
      if (visited.has(node.id)) continue
      visited.add(node.id)
      
      if (!levels.has(level)) {
        levels.set(level, [])
      }
      levels.get(level).push(node)
      
      // Add children to queue
      edges.forEach(edge => {
        if (edge.source === node.id) {
          const targetNode = nodes.find(n => n.id === edge.target)
          if (targetNode && !visited.has(targetNode.id)) {
            queue.push({ node: targetNode, level: level + 1 })
          }
        }
      })
    }
    
    // Position nodes by level
    let maxWidth = 0
    levels.forEach(levelNodes => {
      maxWidth = Math.max(maxWidth, levelNodes.length)
    })
    
    const levelHeight = 150
    const nodeSpacing = 250
    
    levels.forEach((levelNodes, level) => {
      const startX = -(levelNodes.length - 1) * nodeSpacing / 2
      
      levelNodes.forEach((node, index) => {
        node.position.x = startX + index * nodeSpacing
        node.position.y = level * levelHeight
      })
    })
  }

  // Circular layout
  const applyCircularLayout = (nodes, edges) => {
    const radius = Math.max(200, nodes.length * 30)
    const angleStep = (2 * Math.PI) / nodes.length
    
    nodes.forEach((node, index) => {
      const angle = index * angleStep
      node.position.x = Math.cos(angle) * radius
      node.position.y = Math.sin(angle) * radius
    })
  }

  // Grid layout
  const applyGridLayout = (nodes, edges) => {
    const cols = Math.ceil(Math.sqrt(nodes.length))
    const spacing = 200
    
    nodes.forEach((node, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      
      node.position.x = col * spacing - (cols - 1) * spacing / 2
      node.position.y = row * spacing
    })
  }

  // Main layout function
  const applyLayout = (nodes, edges, layoutType = 'Force') => {
    if (nodes.length === 0) return
    
    switch (layoutType) {
      case 'Force':
        applyForceLayout(nodes, edges)
        break
      case 'Hierarchical':
        applyHierarchicalLayout(nodes, edges)
        break
      case 'Circular':
        applyCircularLayout(nodes, edges)
        break
      case 'Grid':
        applyGridLayout(nodes, edges)
        break
      default:
        applyForceLayout(nodes, edges)
    }
  }

  return {
    applyLayout,
    layoutOptions
  }
}