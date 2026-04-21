# Implementation Plan - Client User Profile & Notifications

Implement a comprehensive user profile system for clients, including bookmarks (liked events) and a notification system for social interactions and event updates.

## 1. Database Schema Changes
### `src/models/index.js`
- Add `UserNotification` model:
    - `id`: Primary Key
    - `user_id`: Foreign Key (AppUser)
    - `event_id`: Foreign Key (Event, optional)
    - `type`: Enum ('reaction', 'reply', 'event_update')
    - `message`: Text
    - `target_id`: String (links to specific comment or event)
    - `is_read`: Boolean (default: false)
    - `created_at`: Timestamp
- Define associations: `AppUser.hasMany(UserNotification)` and `UserNotification.belongsTo(AppUser)`.

## 2. Navigation Updates
### `src/views/client/home.ejs`
- Wrap the profile circle in an `<a>` tag: `<a href="/profile">...</a>`.
- Ensure the user's initials or avatar are displayed correctly.

## 3. Backend Routes & Logic
### `src/routes/client.js`
- **Auth Middleware**: Implement `requireUserAuth` to ensure only logged-in clients can access these pages.
- **Profile**: `GET /profile` - Render user info and settings menu.
- **Update Profile**: `POST /profile/update` - Update `first_name`, `last_name`.
- **Security**: `POST /profile/security` - Update password.
- **Bookmarks**: `GET /bookmarks` - Fetch events where user has an entry in `EventLike`.
- **Notifications**: `GET /notifications` - Fetch latest `UserNotification` for the logged-in user.

### `src/routes/api.js`
- **Comment/Reaction Hooks**:
    - When a user likes a comment, create a `UserNotification` for the comment owner.
    - When a user replies to a comment, create a `UserNotification` for the parent comment owner.

## 4. UI Implementation (New Views)
- **`src/views/client/profile.ejs`**: Mobile-first settings page with logout button.
- **`src/views/client/bookmarks.ejs`**: Reuses event card components to show saved events.
- **`src/views/client/notifications.ejs`**: Clean list of alerts with "Mark as Read" functionality.

## 5. Verification Plan
- **Manual Testing**:
    - Log in as a user, click the profile circle.
    - Change name/password and verify changes.
    - Like an event, verify it appears in bookmarks.
    - Have another user react to a comment, verify notification appears.
- **Automated Testing**:
    - Add a test case to `src/tests/auth.test.js` or create a new `user.profile.test.js`.
