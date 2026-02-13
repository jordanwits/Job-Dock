/**
 * Generate consistent colors for team members based on their names.
 * This allows admins to quickly identify which team member is assigned to each appointment.
 */

// Predefined color palette for team members
// Using distinct colors that work well on dark backgrounds
const TEAM_COLORS = [
  { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-300' },
  { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-300' },
  { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-300' },
  { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-300' },
  { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-300' },
  { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-300' },
  { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-300' },
  { bg: 'bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-300' },
  { bg: 'bg-rose-500/20', border: 'border-rose-500', text: 'text-rose-300' },
  { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-300' },
  { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-300' },
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

  const index = Math.abs(hash) % TEAM_COLORS.length
  colorCache.set(normalizedName, index)
  return index
}

/**
 * Get color classes for a team member name
 * Returns colors for all team members if multiple are assigned (comma-separated)
 * Creates a gradient/striped pattern for multi-assignment
 */
export function getTeamMemberColors(assignedToName?: string | null): {
  bg: string
  border: string
  text: string
  isMultiAssignment: boolean
  memberCount: number
  gradientStyle?: React.CSSProperties
} {
  if (!assignedToName || assignedToName.trim() === '') {
    // Use a distinct violet color for unassigned jobs (clearly different from team colors)
    return { 
      bg: 'bg-violet-500/20', 
      border: 'border-violet-500', 
      text: 'text-violet-300',
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
      bg: 'bg-violet-500/20', 
      border: 'border-violet-500', 
      text: 'text-violet-300',
      isMultiAssignment: false,
      memberCount: 0
    }
  }

  // Single member - return their color
  if (memberCount === 1) {
    const firstMember = members[0]?.toLowerCase()
    if (!firstMember) {
      return { 
        bg: 'bg-violet-500/20', 
        border: 'border-violet-500', 
        text: 'text-violet-300',
        isMultiAssignment: false,
        memberCount: 0
      }
    }
    const colorIndex = getColorIndex(firstMember)
    const colors = TEAM_COLORS[colorIndex]
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
    const colorIndex = getColorIndex(normalized)
    return TEAM_COLORS[colorIndex]
  })

  // Create gradient stops - divide evenly
  const percentagePerMember = 100 / memberCount
  const gradientStops = memberColors.map((color, index) => {
    const start = index * percentagePerMember
    const end = (index + 1) * percentagePerMember
    // Extract color from Tailwind class (e.g., 'bg-blue-500/20' -> 'rgba(59, 130, 246, 0.2)')
    const bgColor = getColorValue(color.bg)
    return `${bgColor} ${start}%, ${bgColor} ${end}%`
  }).join(', ')

  // Use first member's border and text color for consistency
  const firstColor = memberColors[0]
  
  return {
    bg: '', // Will use gradient instead
    border: firstColor.border,
    text: firstColor.text,
    isMultiAssignment: true,
    memberCount,
    gradientStyle: {
      background: `linear-gradient(to right, ${gradientStops})`,
    }
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
    'purple-500': [168, 85, 247],
    'green-500': [34, 197, 94],
    'yellow-500': [234, 179, 8],
    'pink-500': [236, 72, 153],
    'cyan-500': [6, 182, 212],
    'orange-500': [249, 115, 22],
    'indigo-500': [99, 102, 241],
    'teal-500': [20, 184, 166],
    'rose-500': [244, 63, 94],
    'amber-500': [245, 158, 11],
    'emerald-500': [16, 185, 129],
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
