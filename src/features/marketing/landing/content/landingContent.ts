/**
 * Landing page copy: CleanDock for cleaning businesses.
 * The page is built around a single 3D phone that travels through the hero + feature stages,
 * swapping its screen per stage. All feature claims map to real product capabilities.
 * Testimonials are illustrative and labelled as such in the UI.
 */

export const landingContent = {
  hero: {
    badge: 'Built for cleaning businesses',
    titleTop: 'The all-in-one app',
    titleHighlight: 'cleaning businesses',
    titleEnd: 'actually run on.',
    subtitle:
      'Quote, schedule, and get paid from one app: recurring cleans, online booking, and before/after proof, all from your phone. Built for cleaning businesses, not borrowed from plumbers.',
    primaryCta: 'Start free',
    secondaryCta: 'See how it works',
    chips: [
      'Quote in 3 minutes',
      '1-tap quote to invoice',
      '24/7 online booking',
      'Card & ACH payments',
    ],
  },

  // Feature stages the traveling phone moves through (index 0 = hero, handled separately).
  // `side` = which side the phone sits on; text goes on the opposite side.
  stages: [
    {
      id: 'quote',
      side: 'left' as const,
      screen: 'invoice' as const,
      kicker: 'Quoting & getting paid',
      title: 'Send a polished quote before you leave the driveway.',
      body: 'Build a branded quote in minutes. When the client says yes, it becomes an invoice in one tap, and they pay by card or ACH.',
      points: [
        'Quotes auto-emailed and ready to approve',
        'One tap turns a quote into an invoice',
        'Pay Now by card or ACH',
      ],
    },
    {
      id: 'schedule',
      side: 'right' as const,
      screen: 'calendar' as const,
      kicker: 'Scheduling & recurring',
      title: 'Your whole week, and every repeat clean, on autopilot.',
      body: 'See every crew at a glance and never double-book. Weekly, biweekly, and monthly cleans repeat themselves, so you set them once.',
      points: [
        'Recurring cleans repeat automatically',
        'Never double-book a crew',
        'Drag to reschedule in seconds',
      ],
    },
    {
      id: 'booking',
      side: 'left' as const,
      screen: 'booking' as const,
      kicker: 'Online booking',
      title: 'Clients book themselves. You just approve.',
      body: 'Share one link on your site, Instagram, or Google profile. Requests come in 24/7, you approve, and it drops onto the calendar.',
      points: [
        'One booking link, everywhere',
        'Requests come in 24/7',
        'Approve and it is scheduled',
      ],
    },
    {
      id: 'joblog',
      side: 'right' as const,
      screen: 'joblog' as const,
      kicker: 'Job logs & proof',
      title: 'Before and after proof, straight from the jobsite.',
      body: 'Cleaners clock their time and snap before/after photos on their phone, so every clean has proof it was done right.',
      points: [
        'Before/after photos on every job',
        'Time tracked automatically',
        'Notes the whole crew can see',
      ],
    },
    {
      id: 'reports',
      side: 'left' as const,
      screen: 'reports' as const,
      kicker: 'Reports & payouts',
      title: 'See what you earned, then export it in a tap.',
      body: 'Track revenue, jobs, and employee pay by date range, and hand your bookkeeper a clean CSV whenever they ask.',
      points: [
        'Revenue and jobs by date range',
        'Employee pay, ready to run',
        'Export to CSV anytime',
      ],
    },
  ],

  testimonials: {
    title: 'The people who cleaned up their business.',
    note: 'Illustrative examples',
    items: [
      {
        quote:
          'I set up my biweekly clients once and stopped redoing my schedule every Sunday night. That alone paid for it.',
        author: 'Maria D.',
        role: 'Owner, Sparkle Maids Co.',
        tag: 'Residential maid service',
      },
      {
        quote:
          'The before-and-after photos ended the “you missed a room” arguments. Now I just send the pictures, and it’s gotten me re-bookings.',
        author: 'Andre W.',
        role: 'Owner, TopShelf Turnover',
        tag: 'Airbnb / short-term rentals',
      },
      {
        quote:
          'Clients used to “forget” the invoice for weeks. Now they tap Pay Now and I’ve got the money before I’m home.',
        author: 'Priya N.',
        role: 'Owner, Crisp & Clean Services',
        tag: 'Move-out + commercial',
      },
    ],
  },

  pricing: {
    title: 'Simple plans that grow with your crew.',
    subtitle:
      'Start solo, add your team when you’re ready. Every plan includes a 14-day free trial — no per-quote fees, no per-clean fees.',
    chips: ['14-day free trial', 'Cancel anytime', 'Your data exports anytime'],
  },

  finalCta: {
    title: 'Spend your nights at home, not in a spreadsheet.',
    subtitle:
      'Join the cleaning businesses running quotes, schedules, bookings, and payments in one app. Set up in an afternoon, starting at $29/month.',
    primaryCta: 'Start free',
    secondaryCta: 'See how it works',
  },
}

export type LandingContent = typeof landingContent
