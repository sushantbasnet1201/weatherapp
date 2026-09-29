# Aurora Weather — Vercel Secure Edition

Animated responsive weather dashboard with Derby, UK as the default location.

## Deploy on Vercel

1. Upload/push this folder to your GitHub repository.
2. Import the repository into Vercel.
3. In Vercel go to **Project Settings → Environment Variables**.
4. Add `OPENWEATHER_API_KEY` and paste your OpenWeather API key as the value.
5. Enable it for Production, Preview, and Development if desired.
6. Redeploy the project.

The API key is never shipped to the browser. Frontend requests go through `/api/geocode` and `/api/weather`, implemented as Vercel serverless functions.

## Important

If the old key was previously committed to Git/GitHub, rotate/revoke that old key in OpenWeather and use the new key only as a Vercel environment variable. Removing a key from the newest files does not erase it from old Git commits.
