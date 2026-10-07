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

User-requested voice revision on 2026-10-07: first-touch emails start with `Hi,`
and `I'm Tim, founder of ShipBoost.` Use a friendly founder invitation, keeping
the $19 offer and benefits. The user's preference supersedes the old rule against
friendly greetings. Version first-touch keys to v3, preserve product observations
in hybrid drafts without duplicating greetings or introductions, and refresh
pending drafts using the same backup and send-lane hold procedure. Follow-ups
use `Hi,` without repeating the introduction; they remain disabled.

Further user correction: preserve SEO beyond launch week and AI recommendations
as the two selling points. Describe these as the purpose of the permanent public
article, rather than guaranteed rankings or recommendations. Merge the founder
introduction and invitation into one paragraph, matching the user's edited email.
Use a v4 experiment with four subjects (article, SEO, ChatGPT, invitation) and
one identical body. Assign deterministically by domain for both new and migrated
pending drafts. Preserve hybrid observations and measure that cohort separately.
The Attribution dashboard compares current subject variants by queued recipients,
sending attempts, unique tracked openers, replies including automatic responses,
and attributed paid orders. Do not declare a winner without results; exclude
detected delivery notices from replies and disabled sources from queued counts.

User-requested greeting refinement: use `Hi {{product_name}} team,` across
first-touch, hybrid, and follow-up templates. Keep the v4 subjects and the rest
of the shared body unchanged; apply the same greeting to every subject variant.
Refresh pending drafts and restore the backed-up schedule after verification.
