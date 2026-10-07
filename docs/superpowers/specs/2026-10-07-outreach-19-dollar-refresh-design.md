# Outreach $19 refresh

Approved by the user on 2026-10-07 after the cold-email audit.

Premium Launch emails must match https://shipboost.io/pricing: $19 once per launch,
a hand-written product article, a reserved launch week, featured placement, a
permanent listing, and dofollow links. Remove the expired founding offer, fixed
spot count, and promises of search rankings or AI recommendations. Keep four
first-touch angles, one hybrid template, and four price-free follow-up angles.
Version template keys so the new campaign can be measured separately. Show
estimated revenue per 1,000 sends, including later-bounced sending attempts in
the denominator, and label estimated amounts clearly.

Refresh only PENDING_REVIEW drafts. Preserve first-touch angles and personalized
openers. Back up every changed row, use conditional updates, and leave sent
history intact. Do not send test messages or trigger sending endpoints.

Temporarily disable the broad HACKER_NEWS source; retain its rows. Respect source
enablement in fetch, launch processing, and automatic sending. Exclude suppressed
contacts from the send queue. Suppress only clearly permanent delivery failures;
do not mass-block role inboxes or infer payment amounts from current pricing.

During deployment and draft migration, hold the existing send lanes with a saved
copy of their schedule. Restore the schedule only after the production release,
updated pending drafts, and source pause have been verified.

Validation: existing suite, pricing and voice checks, source/suppression queue
checks, typecheck, production build, migration dry run, and authenticated
read-only production status. No payment, authentication, or schema changes.

Deployment prerequisite: Vercel rejected the old Node 20 engine. Pin Node 22,
matching the tested local runtime and the platform's supported versions; do not
upgrade application dependencies as part of this change.
