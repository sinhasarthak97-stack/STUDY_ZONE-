# Study Zone

Study tracker, goals, focus timer, built-in practice and answers, a 600+ formula library for every subject, AI Guru (works with no API key), Study Tools, and the Science 3D Lab.

## Put it online with GitHub Pages (free)
1. Create an account at github.com and verify your email.
2. Click **+ > New repository**. Name it `study-zone`, choose **Public**, click **Create repository**.
3. Click **Add file > Upload files**. Upload all nine files from this folder: index.html, sw.js, manifest.webmanifest, logo.png, icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png, README.md. Keep them in the main folder. Click **Commit changes**.
4. Open **Settings > Pages**. Under Build and deployment choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. Wait 1 to 3 minutes. Your app is at `https://YOUR-USERNAME.github.io/study-zone/`.
6. On your phone open the link, then Chrome menu > **Install app** (or Add to Home screen). Safari: Share > **Add to Home Screen**.

## Change the app logo later
1. Make a square PNG (512 px) and save it as `logo.png`. Make `icon-192.png` and `icon-512.png` (same artwork on a solid background, 192 and 512 px) and `icon-maskable-192.png` and `icon-maskable-512.png` (artwork kept inside the middle 70% so Android can crop it).
2. In your repository click **Add file > Upload files**, drop the files with exactly these names, and **Commit changes**. GitHub replaces the old ones.
3. Wait a minute and refresh. To update the icon on your home screen, remove the app and install it again.

## Update the app
Upload the new index.html (and any other changed files) with the same names and commit.

## AI Guru (no API key needed)
Calculations, equations, molar masses, element facts and constants are solved on your device, offline. Open questions go to a free online AI service (Pollinations, `FREE_URL` near the top of the AI code in `index.html`), so the question text leaves the device; do not type personal details. Free services can be slow, busy or change without notice. In **Settings > AI provider** you can switch AI off, or add your own Claude or OpenAI-compatible key for a stronger model. Keys stay only on your device.

## Update the app
Upload the new index.html (and any other changed files) with the same names and commit. If users still see the old version, change the cache name `study-zone-v6` in sw.js (for example to v7) in the same commit.
