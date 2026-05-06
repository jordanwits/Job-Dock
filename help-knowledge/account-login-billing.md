# Account, login, and subscription

## Login and signup

- Login: `/auth/login`  
- Self-serve signup: `/auth/signup`  
- Password reset: `/auth/reset-password`  

If login fails: verify URL (correct subdomain if used), caps lock, reset password, clear site data if stuck in a bad session.

## Profiles

- Employees open **Profile** `/app/profile`.  
- Owners navigating Profile may be redirected to Settings — use **Settings** for company configuration.

## Roles

- **employee** — Jobs, Calendar, Dashboard subset, Profile.  
- **admin** — Full app except some owner-only billing actions.  
- **owner** — Billing & Subscription and highest-level tenant control.

## Subscription and guard rails

The app may gate features behind **billing guard** (BillingGuard) until subscription is valid — paywall or blocked routes present as redirects or messages after login.

## Troubleshooting

1. **Logged into wrong business** — Confirm subdomain/account email; sign out and sign in with correct tenant.  
2. **Feature missing** — Role may hide it; upgrade subscription for team features.  
