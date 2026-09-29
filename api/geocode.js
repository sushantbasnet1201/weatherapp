module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return res.status(500).json({ error: 'Weather API is not configured on the server.' });

  const q = String(req.query.q || '').trim();
  if (q.length < 2 || q.length > 120) return res.status(400).json({ error: 'Enter a valid location.' });

  try {
    const url = new URL('https://api.openweathermap.org/geo/1.0/direct');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '5');
    url.searchParams.set('appid', key);

    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status === 401 ? 500 : upstream.status).json({ error: 'Location search is unavailable right now.' });
    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ error: 'Could not reach the weather service.' });
  }
};
