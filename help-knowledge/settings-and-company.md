# Settings

**Route:** `/app/settings` (owners and admins only — employees go to **Profile** instead)

Settings are organized as **tabs**. Exact visibility:

| Tab | Who typically sees it |
|-----|------------------------|
| Company & Branding | Owners, admins |
| Team Members | Owners, admins (hidden for single-seat non-team accounts) |
| Billing & Subscription | **Owner role only** |
| Email Templates | Owners, admins |
| PDF Templates | Owners, admins |
| Feedback | Owners, admins |
| Help | Owners, admins |
| Tester approval | Only emails matching tester UI visibility |

## Company & Branding

- Company display name  
- Support email shown to clients  
- Company phone  
- **Logo upload** for PDF/email branding consistency  

Always **Save** after edits.

## Email Templates

Subjects and bodies for **invoice** emails and **quote** emails. These merge with outbound sends — if clients see generic text, update templates here after checking Company branding.

## PDF Templates

Upload **invoice** and **quote** PDF backdrop templates where the feature is enabled. Problems with layout usually trace to template file specs or logos.

## Billing & Subscription

Stripe-powered subscription flows. Returning from Stripe may switch to this tab with query hints like `subscribed=1`, `upgraded=1`, or `canceled=1` (URLs get cleaned afterward).

Billing status controls **team** capabilities such as inviting team members (tiers include **team** and **team-plus** style labels in Reports).

If checkout fails → verify card, billing email, retries; escalate with screenshot if reproducible.

## Team Members

Invite and manage staff. **Team** subscription required for multi-user features; single accounts may hide this tab.

## Help tab (not the floating chat)

**Settings → Help** includes:

- **Play Tutorial** — reruns onboarding  
- Explains the **Help** floating button (how-to, troubleshooting, **Send report to engineering**)  
- **Contact support** email link  
- **Install App** — Android/Chrome install prompt or iOS “Add to Home Screen” instructions  
- **Tutorial videos** placeholder for future content  

## Feedback tab

In-app product feedback channel separate from bug reports.

## Troubleshooting

- **Cannot see Billing** — only **owner** role; log in as owner.  
- **Cannot invite team** — subscription tier or billing status may block; check Billing & Subscription.  
- **Emails look wrong** — Company & Branding + Email Templates + PDF Templates together.  
