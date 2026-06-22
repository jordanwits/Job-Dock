import type { ComponentType } from 'react'
import HomeScreen from '../components/screens/HomeScreen'
import InvoicePaidScreen from '../components/screens/InvoicePaidScreen'
import WeekCalendarScreen from '../components/screens/WeekCalendarScreen'
import BookingScreen from '../components/screens/BookingScreen'
import JobLogScreen from '../components/screens/JobLogScreen'
import ReportsScreen from '../components/screens/ReportsScreen'
import { landingContent } from '../content/landingContent'

export type ScreenKey = 'home' | 'invoice' | 'calendar' | 'booking' | 'joblog' | 'reports'
export type StageSide = 'left' | 'right'

/** Maps a screen key to the React component shown on the phone. */
export const SCREENS: Record<ScreenKey, ComponentType> = {
  home: HomeScreen,
  invoice: InvoicePaidScreen,
  calendar: WeekCalendarScreen,
  booking: BookingScreen,
  joblog: JobLogScreen,
  reports: ReportsScreen,
}

/**
 * The phone's journey down the page. Index 0 is the hero; the rest come from the content
 * stages. `side` is the side the phone rests on (text sits opposite). The page reserves a
 * matching slot per stage and marks its centre with `[data-phone-stage]`.
 */
export const JOURNEY: { side: StageSide; screen: ScreenKey }[] = [
  { side: 'right', screen: 'home' },
  ...landingContent.stages.map((s) => ({ side: s.side, screen: s.screen })),
]

export const STAGE_COUNT = JOURNEY.length
