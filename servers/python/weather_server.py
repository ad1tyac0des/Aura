import os
import httpx
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv

load_dotenv()

ACCU_WEATHER_API_KEY = os.getenv("ACCU_WEATHER_API_KEY")
if not ACCU_WEATHER_API_KEY:
    raise EnvironmentError("Error: ACCU_WEATHER_API_KEY is not set in environment variables.")


mcp = FastMCP("weather-server")


# Creating the two helper fns outside the tool defintion to keep the tool clean.
# Step1: City name -> Location Key
async def get_location_key(city: str) -> dict:
    url = "https://dataservice.accuweather.com/locations/v1/cities/search"
    params = {"apikey": ACCU_WEATHER_API_KEY, "q": city}
    
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params=params)
        data = res.json()
    
    if not data:
        raise ValueError(f'City {city} not found.')
    
    return {
        "key": data[0]["Key"],
        "name": data[0]["LocalizedName"],
        "country": data[0]["Country"]["LocalizedName"]
    }

# Step2: Location Key -> Current Weather
async def get_current_weather(location_key: str) -> dict:
    url = f"https://dataservice.accuweather.com/currentconditions/v1/{location_key}"
    params = {"apikey": ACCU_WEATHER_API_KEY, "details": "true"}
    
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params=params)
        data = res.json()
    
    return data[0]


@mcp.tool(description="Get current weather conditions for any city")
async def get_current_weather_tool(city: str) -> str:
    """
    Args:
        city: City name, e.g. 'Delhi' or 'Lucknow'
    """
    location = await get_location_key(city)
    weather = await get_current_weather(location["key"])
    
    return f"""Weather in {location["name"]}, {location["country"]}:
- Condition: {weather["WeatherText"]}
- Temperature: {weather["Temperature"]["Metric"]["Value"]}°C / {weather["Temperature"]["Imperial"]["Value"]}°F
- Feels Like: {weather["RealFeelTemperature"]["Metric"]["Value"]}°C
- Humidity: {weather["RelativeHumidity"]}%
- Wind: {weather["Wind"]["Speed"]["Metric"]["Value"]} km/h {weather["Wind"]["Direction"]["Localized"]}
- UV Index: {weather["UVIndex"]} ({weather["UVIndexText"]})
- Visibility: {weather["Visibility"]["Metric"]["Value"]} km""".strip()

if __name__ == "__main__":
    mcp.run(transport="stdio")