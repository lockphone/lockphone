# App Store submission checklist

## Apple Developer

- [ ] Accept the current Apple Developer Program agreement (Account Holder)
- [ ] Renew membership before 2026-09-20 if submission/review may extend beyond that date
- [x] Register `group.www.coreader.studio.lockyour`
- [x] Register the main app and three extension App IDs
- [x] Enable App Groups, App Attest, Family Controls, and required extension capabilities
- [x] Assign all four targets to the shared App Group
- [x] Assign the Family Controls distribution capability to the main app, Monitor, and Shield identifiers
- [x] Refresh development profiles and verify a signed four-target archive

## App Store Connect

- [x] Renew/accept the Paid Apps agreement (Account Holder)
- [x] Submit Tikpal banking and W-9 information
- [x] Confirm tax and banking information has moved to active
- [x] Create the iOS app record for `Lock Your` (`6807374179`)
- [x] Add Simplified Chinese localization with the product name `占住`
- [ ] Select the China price point closest to, but not above, CNY 1.99 and keep Apple's automatic regional mapping
- [x] Upload English and Simplified Chinese metadata
- [x] Upload the three primary screenshots for each localization (four 6.5-inch screenshots uploaded per localization)
- [ ] Complete App Privacy using `privacy-questionnaire.md`
- [ ] Complete age rating and export-compliance questions
- [ ] Paste `review-notes.md` into App Review Information
- [x] Deliver signed build `1.0 (1)` to TestFlight (Apple processing and TestFlight compliance pending)
- [x] Publish a signed internal-testing IPA with Coot
- [ ] Run internal IPA/TestFlight verification on a physical iPhone
- [ ] Submit the selected build for review

## Production services

- [x] Implement and test the Cloudflare Email Sending REST adapter
- [x] Enable and verify `lockyourphone.app` Email Routing and Email Sending DNS
- [x] Create a least-privilege `Email Sending: Edit` Cloudflare API token
- [x] Configure `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `verify@lockyourphone.app` on `lock-api`
- [x] Deploy the Cloudflare adapter and updated website to Railway
- [ ] Verify English and Chinese OTP delivery and deep-link return (both localized messages arrived in the production inbox; App deep-link return remains)
- [x] Request App Store Connect API access
- [x] Create and configure the least-privilege sales-report API key (`Y9JUNU9J36`)
- [x] Verify idempotent sales report import and WebSocket snapshot updates
- [ ] Verify a real refund correction after report data becomes available
- [x] Switch App and API App Attest from `development` to `production`
- [ ] Replace the website's “Coming soon” CTA with the final App Store URL

## Brand and open source

- [x] Create the shared Logo and App Icon, with transparent and dark-background variants
- [x] Apply the Logo to the iOS App Icon, website header, favicon, and Apple touch icon
- [x] Add the final English and Chinese brand lines to the website
- [x] Add `hello@lockphone.app`, GitHub, X, TikTok, and Reddit links to the public website
- [x] Initialize the public repository and publish the complete source under `https://github.com/lockphone`
- [x] Choose an open-source license and run a secrets/history audit before the first push
