import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "dotenv";

config(); // Load .env

const ACCU_WEATHER_API_KEY = process.env.ACCU_WEATHER_API_KEY;
if (!ACCU_WEATHER_API_KEY) {
    throw new Error("Error: ACCU_WEATHER_API_KEY is not set in environment variables.");
}

const server = new McpServer({
    name: "weather-server",
    version: "1.0.0",
});

async function getLocationKey(city) {
    const url = new URL("https://dataservice.accuweather.com/locations/v1/cities/search");
    url.searchParams.append("apikey", ACCU_WEATHER_API_KEY);
    url.searchParams.append("q", city);

    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.length === 0) {
        throw new Error(`City ${city} not found.`);
    }

    return {
        key: data[0].Key,
        name: data[0].LocalizedName,
        country: data[0].Country.LocalizedName,
    };
}

async function getCurrentWeather(locationKey) {
    const url = new URL(`https://dataservice.accuweather.com/currentconditions/v1/${locationKey}`);
    url.searchParams.append("apikey", ACCU_WEATHER_API_KEY);
    url.searchParams.append("details", "true");

    const res = await fetch(url);
    const data = await res.json();

    return data[0];
}

server.tool(
    "get_current_weather_tool",
    "Get current weather conditions for any city",
    { city: z.string().describe("City name, e.g. 'Delhi' or 'Lucknow'") },
    async ({ city }) => {
        const location = await getLocationKey(city);
        const weather = await getCurrentWeather(location.key);

        const weatherText = `Weather in ${location.name}, ${location.country}:
- Condition: ${weather.WeatherText}
- Temperature: ${weather.Temperature.Metric.Value}°C / ${weather.Temperature.Imperial.Value}°F
- Feels Like: ${weather.RealFeelTemperature.Metric.Value}°C
- Humidity: ${weather.RelativeHumidity}%
- Wind: ${weather.Wind.Speed.Metric.Value} km/h ${weather.Wind.Direction.Localized}
- UV Index: ${weather.UVIndex} (${weather.UVIndexText})
- Visibility: ${weather.Visibility.Metric.Value} km`.trim();

        return {
            content: [{ type: "text", text: weatherText }],
        };
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);
