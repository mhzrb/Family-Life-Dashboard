export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const city = search.get("city") || "Hengelo";
  try {
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { headers: { accept: "application/json" } },
    );
    const geo = (await geoResponse.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string; country_code: string }>;
    };
    const place = geo.results?.[0];
    const weatherUrl = place
      ? `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`
      : null;

    const [weatherResponse, ratesResponse] = await Promise.all([
      weatherUrl ? fetch(weatherUrl) : Promise.resolve(null),
      fetch("https://api.frankfurter.dev/v2/rates?base=EUR&quotes=USD,GBP,CAD"),
    ]);
    const weather = weatherResponse ? await weatherResponse.json() : null;
    const rateRows = (await ratesResponse.json()) as Array<{ quote: string; rate: number; date: string }>;
    const rates = Object.fromEntries(rateRows.map((row) => [row.quote, row.rate]));

    return Response.json(
      { weather, place, rates, updatedAt: new Date().toISOString() },
      { headers: { "cache-control": "public, max-age=900" } },
    );
  } catch {
    return Response.json(
      { weather: null, place: { name: city }, rates: { USD: 1.16, GBP: 0.87, CAD: 1.59 }, updatedAt: null },
      { status: 200 },
    );
  }
}

