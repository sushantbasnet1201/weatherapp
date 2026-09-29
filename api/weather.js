module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return res.status(500).json({ error: 'Weather API is not configured on the server.' });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const units = req.query.units === 'imperial' ? 'imperial' : 'metric';
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Invalid coordinates.' });
  }

  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), units, appid: key });
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?${params}`)
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      const status = currentRes.status === 401 || forecastRes.status === 401 ? 500 : Math.max(currentRes.status, forecastRes.status);
      return res.status(status).json({ error: 'Weather data is unavailable right now.' });
    }

    const [current, forecast] = await Promise.all([currentRes.json(), forecastRes.json()]);
    return res.status(200).json({ current, forecast });
  } catch {
    return res.status(502).json({ error: 'Could not reach the weather service.' });
  }
};
