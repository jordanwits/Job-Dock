export type PlanTier = 'single' | 'team' | 'team-plus'

export interface Plan {
  id: PlanTier
  name: string
  description: string
  price: string
  features: string[]
}

export const SIGNUP_PLANS: Plan[] = [
  {
    id: 'single',
    name: 'Single',
    description: 'Perfect for solo operators',
    price: '$29.99/mo',
    features: [
      'Unlimited jobs and contacts',
      'Invoice and quote generation',
      'Time tracking',
      'Photo capture',
      'Calendar scheduling',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Up to 5 users',
    price: '$59.99/mo',
    features: [
      'Everything in Single',
      'Up to 5 team members',
      'Team time tracking',
      'Shared calendar',
      'Role-based permissions',
    ],
  },
  {
    id: 'team-plus',
    name: 'Team+',
    description: 'Unlimited users',
    price: '$99.99/mo',
    features: [
      'Everything in Team',
      'Unlimited team members',
      'No user cap',
      'Best for growing crews',
    ],
  },
]
