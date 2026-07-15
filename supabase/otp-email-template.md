# Switch signup confirmation from link → OTP

## Supabase Dashboard steps

1. Open **Authentication → Email Templates → Confirm signup**
2. Replace the template body so it shows the 6-digit code (not the magic link)

### Recommended template

**Subject:** Your Layali verification code

**Body:**

```html
<h2>Welcome to Layali</h2>
<p>Your verification code is:</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
<p>Enter this code on the signup page to confirm your account.</p>
<p>This code expires in 1 hour.</p>
```

3. Keep **Confirm email** enabled under **Authentication → Providers → Email**
4. Optionally disable or ignore the Confirm signup link — users will enter the OTP in the app instead

## How the app uses it

1. User fills signup form → `signUp` creates the account and emails the OTP
2. User enters the 6-digit code on the next screen
3. App calls `verifyOtp({ email, token, type: 'signup' })` (falls back to `email` if needed)
4. After verification, user continues to the beauty survey
