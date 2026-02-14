/**
 * Generate consistent colors for team members based on their names.
 * This allows admins to quickly identify which team member is assigned to each appointment.
 */

// Blue is reserved for unassigned appointments
const UNASSIGNED_COLOR = { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300', value: 'blue-500' }

// Predefined color palette for team members
// Using maximally distinct colors that work well on dark backgrounds
// Colors are spaced across the color spectrum for maximum visual distinction
// Note: blue-500, cyan-500, indigo-500, teal-500, and rose-500 are reserved/removed to avoid confusion
export const TEAM_COLORS = [
  { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-300', value: 'red-500' },
  { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-300', value: 'orange-500' },
  { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-300', value: 'yellow-500' },
  { bg: 'bg-lime-500/20', border: 'border-lime-500', text: 'text-lime-300', value: 'lime-500' },
  { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-300', value: 'green-500' },
  { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-300', value: 'violet-500' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-300', value: 'purple-500' },
  { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500', text: 'text-fuchsia-300', value: 'fuchsia-500' },
  { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-300', value: 'pink-500' },
]

// Cache to ensure consistent colors for the same team member
const colorCache = new Map<string, number>()

/**
 * Get a consistent color index for a team member name
 * Uses a better hash function to reduce collisions
 */
function getColorIndex(name: string): number {
  // Normalize name: lowercase and trim for consistent hashing
  const normalizedName = name.toLowerCase().trim()
  
  if (colorCache.has(normalizedName)) {
    return colorCache.get(normalizedName)!
  }

  // Improved hash function (djb2 variant) for better distribution
  let hash = 5381
  for (let i = 0; i < normalizedName.length; i++) {
    hash = ((hash << 5) + hash) + normalizedName.charCodeAt(i)
  }

  // Use TEAM_COLORS.length to avoid blue (blue is reserved for unassigned)
  // This ensures hash-based assignment never returns blue
  const index = Math.abs(hash) % TEAM_COLORS.length
  colorCache.set(normalizedName, index)
  return index
}

/**
 * Get color classes for a team member name
 * Returns colors for all team members if multiple are assigned (comma-separated)
 * Creates a gradient/striped pattern for multi-assignment
 * @param assignedToName - Comma-separated list of team member names
 * @param userColorMap - Optional map of user names to color values (e.g., "blue-500")
 */
export function getTeamMemberColors(
  assignedToName?: string | null,
  userColorMap?: Map<string, string> | Record<string, string>
): {
  bg: string
  border: string
  text: string
  isMultiAssignment: boolean
  memberCount: number
  gradientStyle?: React.CSSProperties
} {
  if (!assignedToName || assignedToName.trim() === '') {
    // Use blue color for unassigned jobs
    return { 
      ...UNASSIGNED_COLOR,
      isMultiAssignment: false,
      memberCount: 0
    }
  }

  // Split and count team members
  const members = assignedToName.split(',').map(m => m.trim()).filter(m => m.length > 0)
  const memberCount = members.length
  const isMultiAssignment = memberCount > 1

  if (memberCount === 0) {
    return { 
      ...UNASSIGNED_COLOR,
      isMultiAssignment: false,
      memberCount: 0
    }
  }

  // Single member - return their color
  if (memberCount === 1) {
    const firstMember = members[0]
    const firstMemberLower = firstMember?.toLowerCase()
    if (!firstMemberLower) {
      return { 
        ...UNASSIGNED_COLOR,
        isMultiAssignment: false,
        memberCount: 0
      }
    }
    
    // Check if user has a stored color
    let colors
    if (userColorMap) {
      const colorValue = userColorMap instanceof Map 
        ? userColorMap.get(firstMember) || userColorMap.get(firstMemberLower)
        : userColorMap[firstMember] || userColorMap[firstMemberLower]
      
      if (colorValue) {
        // Check if it's a hex color
        if (colorValue.startsWith('#')) {
          // Convert hex to Tailwind-like color classes
          colors = hexToColorClasses(colorValue)
        } else {
          // Check if it's a preset color
          const storedColor = TEAM_COLORS.find(c => c.value === colorValue)
          if (storedColor) {
            colors = storedColor
          } else {
            // Fallback to hash-based color if stored color not found
            const colorIndex = getColorIndex(firstMemberLower)
            colors = TEAM_COLORS[colorIndex]
          }
        }
      } else {
        // No stored color, use hash-based
        const colorIndex = getColorIndex(firstMemberLower)
        colors = TEAM_COLORS[colorIndex]
      }
    } else {
      // No color map provided, use hash-based
      const colorIndex = getColorIndex(firstMemberLower)
      colors = TEAM_COLORS[colorIndex]
    }
    
    // If it's a hex color, we need to use inline styles
    if (colors.hex) {
      const hex = colors.hex
      const hexColor = hex.replace('#', '')
      const r = parseInt(hexColor.substring(0, 2), 16)
      const g = parseInt(hexColor.substring(2, 4), 16)
      const b = parseInt(hexColor.substring(4, 6), 16)
      
      return {
        bg: '', // Will use inline style instead
        border: '', // Will use inline style instead
        text: '', // Will use inline style instead
        isMultiAssignment: false,
        memberCount: 1,
        gradientStyle: {
          backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
          borderLeftColor: `rgb(${r}, ${g}, ${b})`,
          borderTopColor: `rgb(${r}, ${g}, ${b})`,
          borderRightColor: `rgb(${r}, ${g}, ${b})`,
          borderBottomColor: `rgb(${r}, ${g}, ${b})`,
          borderColor: `rgb(${r}, ${g}, ${b})`,
          color: `rgb(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)})`,
        }
      }
    }
    
    return {
      ...colors,
      isMultiAssignment: false,
      memberCount: 1
    }
  }

  // Multiple members - create gradient
  // Get colors for each member
  const memberColors = members.map(member => {
    const normalized = member.toLowerCase()
    
    // Check if user has a stored color
    let colorIndex
    if (userColorMap) {
      const colorValue = userColorMap instanceof Map 
        ? userColorMap.get(member) || userColorMap.get(normalized)
        : userColorMap[member] || userColorMap[normalized]
      
      if (colorValue) {
        // Check if it's a hex color
        if (colorValue.startsWith('#')) {
          // For hex colors, we'll use inline styles in the gradient
          // Return a color object that can be used in gradients
          const hexColor = hexToColorClasses(colorValue)
          return hexColor
        } else {
          // Check if it's a preset color
          const storedColorIndex = TEAM_COLORS.findIndex(c => c.value === colorValue)
          if (storedColorIndex !== -1) {
            colorIndex = storedColorIndex
          } else {
            // Stored color not found in TEAM_COLORS (might be blue), use hash-based
            colorIndex = getColorIndex(normalized)
          }
        }
      } else {
        // No stored color, use hash-based
        colorIndex = getColorIndex(normalized)
      }
    } else {
      // No color map provided, use hash-based
      colorIndex = getColorIndex(normalized)
    }
    
    return TEAM_COLORS[colorIndex]
  })

  // Create gradient stops - divide evenly
  const percentagePerMember = 100 / memberCount
  const gradientStops = memberColors.map((color, index) => {
    const start = index * percentagePerMember
    const end = (index + 1) * percentagePerMember
    
    // Handle hex colors
    if (color.hex) {
      const hexColor = color.hex.replace('#', '')
      const r = parseInt(hexColor.substring(0, 2), 16)
      const g = parseInt(hexColor.substring(2, 4), 16)
      const b = parseInt(hexColor.substring(4, 6), 16)
      const bgColor = `rgba(${r}, ${g}, ${b}, 0.2)`
      return `${bgColor} ${start}%, ${bgColor} ${end}%`
    }
    
    // Extract color from Tailwind class (e.g., 'bg-blue-500/20' -> 'rgba(59, 130, 246, 0.2)')
    const bgColor = getColorValue(color.bg)
    return `${bgColor} ${start}%, ${bgColor} ${end}%`
  }).join(', ')

  // Use first member's border and text color for consistency
  const firstColor = memberColors[0]
  
  // Handle hex color for border
  let borderStyle: string | undefined
  let textStyle: string | undefined
  if (firstColor.hex) {
    const hexColor = firstColor.hex.replace('#', '')
    const r = parseInt(hexColor.substring(0, 2), 16)
    const g = parseInt(hexColor.substring(2, 4), 16)
    const b = parseInt(hexColor.substring(4, 6), 16)
    borderStyle = `rgb(${r}, ${g}, ${b})`
    textStyle = `rgb(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)})`
  }
  
  return {
    bg: '', // Will use gradient instead
    border: firstColor.border || '', // Empty for hex colors
    text: firstColor.text || '', // Empty for hex colors
    isMultiAssignment: true,
    memberCount,
    gradientStyle: {
      background: `linear-gradient(to right, ${gradientStops})`,
      ...(borderStyle && { borderColor: borderStyle }),
      ...(textStyle && { color: textStyle }),
    }
  }
}

/**
 * Convert hex color to color classes (for custom colors)
 */
function hexToColorClasses(hex: string): {
  bg: string
  border: string
  text: string
  value: string
  hex?: string
} {
  // Remove # if present
  const hexColor = hex.replace('#', '')
  
  // Convert hex to RGB
  const r = parseInt(hexColor.substring(0, 2), 16)
  const g = parseInt(hexColor.substring(2, 4), 16)
  const b = parseInt(hexColor.substring(4, 6), 16)
  
  // Create rgba strings for background (20% opacity) and border (100% opacity)
  const bgRgba = `rgba(${r}, ${g}, ${b}, 0.2)`
  const borderRgb = `rgb(${r}, ${g}, ${b})`
  const textRgb = `rgb(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)})`
  
  return {
    bg: '', // Will use inline style
    border: '', // Will use inline style
    text: '', // Will use inline style
    value: hex,
    hex: hex,
  }
}

/**
 * Convert Tailwind color class to rgba value
 * Handles opacity variants like /20, /30, etc.
 */
function getColorValue(tailwindClass: string): string {
  // Map of Tailwind colors to RGB values
  const colorMap: Record<string, [number, number, number]> = {
    'blue-500': [59, 130, 246],
    'red-500': [239, 68, 68],
    'orange-500': [249, 115, 22],
    'yellow-500': [234, 179, 8],
    'lime-500': [132, 204, 22],
    'green-500': [34, 197, 94],
    'violet-500': [139, 92, 246],
    'purple-500': [168, 85, 247],
    'fuchsia-500': [217, 70, 239],
    'pink-500': [236, 72, 153],
  }

  // Extract color name and opacity
  const match = tailwindClass.match(/bg-(\w+-\d+)\/(\d+)/)
  if (!match) {
    // Fallback to default
    return 'rgba(59, 130, 246, 0.2)'
  }

  const [, colorName, opacity] = match
  const rgb = colorMap[colorName] || [59, 130, 246]
  const alpha = parseInt(opacity) / 100

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

/**
 * Clear the color cache (useful for testing or if team members change significantly)
 */
export function clearTeamColorCache(): void {
  colorCache.clear()
}
