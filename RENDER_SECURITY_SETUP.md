# Render Deployment - Security Setup

## Good News! 🎉

The database migration now runs **automatically** during app startup! You don't need to run any SQL commands manually.

---

## What You Need to Do:

### Step 1: Generate SESSION_SECRET

On your local computer, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (looks like: `8f3a2b1c4d5e6f7890abcdef1234567890fedcba0987654321abcdef12345678`)

### Step 2: Add Environment Variables in Render

1. Go to https://dashboard.render.com/
2. Click on your **rowbooster** web service
3. Click **"Environment"** in the left sidebar
4. Click **"Add Environment Variable"** for each:

| Key | Value |
|-----|-------|
| `SESSION_SECRET` | (paste the value you generated) |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `true` |

### Step 3: Redeploy

Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## That's It! ✅

The app will now:
1. Start up
2. **Automatically create all security tables** (you'll see logs like):
   ```
   [API-KEY-MANAGER] Starting database initialization...
   [API-KEY-MANAGER] ✅ User encrypted key columns ready
   [API-KEY-MANAGER] ✅ Rate limits table ready
   [API-KEY-MANAGER] ✅ API key audit log table ready
   [API-KEY-MANAGER] ✅ Secure tokens table ready
   [API-KEY-MANAGER] ✅ Database initialization complete!
   ```
3. Be fully secured and ready to use

---

## Visual Guide: Adding Environment Variables in Render

### Finding the Environment Tab:
```
┌─────────────────────────────────────────────────────────────┐
│  Render Dashboard > rowbooster (Web Service)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tabs at top or sidebar:                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Events │ Logs │ ► Environment │ Shell │ Settings │  │   │
│  └─────────────────────────────────────────────────────┘   │
│                     ↑                                       │
│                Click this                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Adding a Variable:
```
┌─────────────────────────────────────────────────────────────┐
│  Environment Variables                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Key: [ SESSION_SECRET_________________________ ]           │
│                                                             │
│  Value: [ 8f3a2b1c4d5e6f78...paste_here_______ ]           │
│                                                             │
│  [Save Changes]                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## After Deployment Checklist

- [ ] App starts without errors (check Logs tab)
- [ ] See "Database initialization complete!" in logs
- [ ] Login works
- [ ] Settings page works

---

## Troubleshooting

### "Secure vault disabled" in logs
- `SESSION_SECRET` not set correctly
- Solution: Go to Environment tab, verify SESSION_SECRET is there

### App crashes on startup
- Check Logs tab for error messages
- Make sure DATABASE_URL is still set

### Login not working
- Clear browser cookies
- Session secret change invalidates old sessions