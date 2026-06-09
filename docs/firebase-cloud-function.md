# Secure leaderboard upload Cloud Function (Node.js)

This example shows a minimal Firebase Cloud Function that accepts POSTs from the extension, validates a shared secret header, and writes the submitted score objects into the Realtime Database under `/leaderboard`.

Security: keep the secret private. In production, rotate periodically and consider using Firebase Authentication.

## Deploy steps
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Log in: `firebase login`
3. Initialize functions in a project folder: `firebase init functions` (choose JavaScript or TypeScript)
4. Copy the function below into `functions/index.js` (or `src/index.ts` for TS) and deploy with `firebase deploy --only functions`.

## Example Cloud Function (Node.js, Express style)
```js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Put a long random value here and store it securely. The extension will send it in header X-Leaderboard-Secret.
const EXPECTED_SECRET = process.env.LEADERBOARD_SECRET || "change-me";

exports.submitLeaderboard = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const secret = req.get("X-Leaderboard-Secret") || req.query.secret || null;
  if (!secret || secret !== EXPECTED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Basic sanitation
  const entry = {
    username: String(payload.username ?? "unknown").slice(0, 64),
    runId: String(payload.runId ?? "").slice(0, 128) || null,
    maxWave: typeof payload.maxWave === "number" ? payload.maxWave : null,
    finalWave: typeof payload.finalWave === "number" ? payload.finalWave : null,
    startMoney: typeof payload.startMoney === "number" ? payload.startMoney : null,
    finalMoney: typeof payload.finalMoney === "number" ? payload.finalMoney : null,
    result: payload.result ?? null,
    startedAt: payload.startedAt ?? null,
    endedAt: payload.endedAt ?? null,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };

  try {
    const ref = admin.database().ref("/leaderboard");
    const pushRef = await ref.push(entry);
    return res.status(200).json({ ok: true, id: pushRef.key });
  } catch (err) {
    console.error("Write failed", err);
    return res.status(500).json({ error: "write_failed" });
  }
});
```

## Environment variable
Set the `LEADERBOARD_SECRET` on the Functions runtime (don't hardcode in source):
```
firebase functions:config:set leaderboard.secret="your-very-long-secret"
# then in code access with functions.config().leaderboard.secret
```
Or set environment_runtime variables per your deployment method.

## Using the function from the extension
- Use the function's URL (e.g. `https://us-central1-<project>.cloudfunctions.net/submitLeaderboard`) as the `Leaderboard URL` in the popup.
- In the popup `Upload Secret` field paste the same secret.
- Toggle `Enable Leaderboard` and test upload.

This route allows you to keep your RTDB rules locked down and verify requests server-side before writing.
