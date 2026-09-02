# App Review notes

Lock Phone is a paid-download focus utility. It has no in-app purchase, subscription, advertising, user-generated avatar upload, or required login.

## How to review the core flow

1. Launch the app and tap **Authorize Screen Time**.
2. Approve Apple's Family Controls authorization sheet.
3. The focus session begins immediately. If no allowed app has been selected, all selectable third-party apps are shielded.
4. Tap the empty allowed-app slot and choose exactly one app in Apple's Family Activity picker. Category and website selections are ignored. The selected app remains fixed for the current session.
5. Background Lock Phone and open another third-party app to see the system Shield Configuration UI. The allowed app remains available.
6. Return to Lock Phone and hold the finish control for two seconds to end the session and remove the shields.

The environment, ambient sound, timer, and Live Activity are local features. Family Controls selections are represented by Apple privacy-preserving tokens and are stored only in the shared App Group; they are never uploaded.

Email verification is optional and does not block the core flow. It is used only to restore cumulative time on another device and to publish a masked identity on the public leaderboard. No review account is required. If email delivery is unavailable in the review environment, all locking features remain fully testable without email.

The app requires the Family Controls distribution entitlement for the main app, Device Activity Monitor extension, and Shield Configuration extension. The public website and privacy/support pages are available at:

- https://lock-web-production.up.railway.app/
- https://lock-web-production.up.railway.app/privacy
- https://lock-web-production.up.railway.app/support
