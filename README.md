# Study Zone 2.0

A study tracker, practice generator, flashcards, 600+ formula library, AI Guru and Science 3D Lab. It runs as a website (GitHub Pages) and builds into an Android APK automatically with GitHub Actions.

## What is new
**2.1**
- **PYQs tab** for previous year questions: import files or paste text, browse by exam, subject, year and type, practise, take a timed test, and track what you got right. Multiple-choice, numerical and written questions are supported.
- **PYQs in practice:** matching questions are mixed into normal practice and random practice (you choose how often: off, 25%, 50% or 75%).
- **Question packs in the APK:** put files in a `pyq/` folder and the build bundles them, so they work offline.
- **Modern design:** a new look with a floating glass navigation bar, gradient accents and softer cards, in light and dark mode.
- **CBSE Class 10 board blueprint** (Resources): marks by unit for Maths, Science, Social Science and English.

**2.0**
- 287 built-in practice questions, Flashcards with spaced repetition, grouped study links, and automatic APK builds.

## Adding your PYQs
The app does not ship with previous year papers. Add the ones you have, from official sources such as cbseacademic.nic.in, in either of these ways.

**Inside the app (easiest):** open the **PYQs** tab, choose files or paste text, and tap **Import text**. Questions are saved on that phone and work offline. Raw text copied from a PDF can be cleaned up with **Structure with AI**, but check the answers against the marking scheme.

**Built into the APK:** create files in a `pyq/` folder of your repository (**Add file > Create new file**, name it `pyq/cbse-10-2023.txt`) and paste the questions. The next build bundles them and every install gets them. See `pyq/_README.txt` for the format. Multiple-choice questions need an answer; written questions can carry a model answer.

## Set up (works from a phone browser)
1. **Upload the files.** In your repository tap **Add file > Upload files** and add every file from this zip that is *not* inside `.github` (index.html, sw.js, manifest.webmanifest, the five PNG files, package.json, capacitor.config.json, build.mjs, debug.keystore, .gitignore, README.md). Question packs go in a `pyq/` folder (see below). Commit.
2. **Add the workflow.** Open your existing workflow file under `.github/workflows/` (or **Add file > Create new file** and type `.github/workflows/android.yml`). Replace everything with the contents of `android.yml`. Commit. If you have two workflow files, delete the old one so they do not both run.
3. **Allow releases.** Repository **Settings > Actions > General > Workflow permissions** > choose **Read and write permissions** > Save.
4. **Run it.** Push a commit, or open **Actions > Study Zone Android > Run workflow**.
5. **Get the APK.** Open **Releases** and download the `.apk` from "Study Zone latest build". Or open the finished run and use **Artifacts**.

## Versions
- Normal pushes create versions like `2.0.0-b15` and refresh the `latest` pre-release.
- To publish a named version, create a tag such as `v2.1.0` (Releases > Draft a new release > choose a new tag). The APK is attached to that release.
- Change the number in `package.json` when you want a new base version.

## Signing
- Builds are signed with `debug.keystore` in this repo, so each new APK installs as an update over the old one and keeps your data.
- That key is public (the repo may be public). It is fine for a personal app. Do not publish this APK on Google Play.
- For a private release key, add four repository secrets: `ANDROID_KEYSTORE_BASE64` (base64 of your keystore), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Tagged builds then also produce `-release.apk`.

## Commands (for a computer)
```
npm install
node build.mjs check    # validate files and JavaScript
node build.mjs web      # build www/
node build.mjs smoke    # browser test (npx playwright install chromium first)
```

## AI Guru
Calculations, equations, molar masses, element facts and constants are solved on the device, offline. Open questions go to a free online AI service (Pollinations), so the question text leaves the device; do not type personal details. Free services can be slow, busy or change without notice. In Settings > AI provider you can turn AI off or add your own key.

## Change the logo
Replace `logo.png` (512 px square) and the four icon files with the same names (`icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`; keep the artwork inside the middle 70% for the maskable pair). The APK icon and splash screen are generated from `logo.png` during the build.
