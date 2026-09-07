# NEXORA

A Firebase-powered social + messaging PWA foundation.

## What works
- Email/password signup and login
- Persistent Firebase sessions
- Firestore user profiles
- Create posts
- Live Firestore feed
- Like/unlike
- Comments
- Search users
- Follow/unfollow
- Real-time direct messaging
- Conversation list
- Notifications
- Edit profile
- Logout
- Responsive premium mobile UI

## Setup
1. Create a Firebase Web App in the existing NEXORA Firebase project.
2. Copy the Web SDK config into `firebase-config.js`.
3. Enable Authentication -> Email/Password.
4. Create Firestore.
5. Deploy the rules in `firestore.rules`.
6. Host this static project using GitHub Pages or another static host.

## Firestore indexes
Some compound queries may cause Firebase to show an index creation link. Open that link and create the suggested index.

## Important
This project intentionally does not use `google-services.json` because that file is for native Android Firebase configuration. This is a web/PWA project and needs the Firebase Web SDK configuration.


## Extended UI modules
The codebase also includes account controls, local draft persistence, keyboard shortcuts, premium settings UI, image previews, profile insights, accessibility focus states, responsive refinements and reusable UI helpers.
