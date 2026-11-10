# M V67 — Live weather in the portfolio

## What it does

The portfolio's weather stage represents an approximate **forecast for Leiria, Portugal**, not the visitor's current location and not a direct rain sensor.

- Source: **MET Norway Locationforecast 2.0**, global compact forecast for fixed coordinates `39.74,-8.81`.
- `m-world-weather.mjs`: validates forecast timestamp, cloud fraction, next-hour precipitation, wind speed/direction and temperature; discards invalid/stale records and provides a clearly labeled diagnostic demo.
- `m-world-weather-stage.mjs`: low-opacity cloud, rainfall/snow and wind particles behind a pointer-transparent overlay; visible forecast/status and clickable provider/CC BY 4.0 credits.
- `m-world-weather-actor.mjs` and `m-world-3d.mjs`: light wind response within the existing V66 secondary-joint compositor and an optional removable procedural umbrella. The original V6 GLB, texture maps, skinning, six clips and authored gestures remain untouched.
- The forecast reader and ambiance are paused or neutral when appropriate; weather effects never override reduced motion, typing, sleeping, explicit gestures, navigation or the visitor's attention.
- No new Cloudflare Worker, cron, API key, geolocation prompt, tracking parameter or paid service.

## License and request policy

MET Norway's public data is available for commercial reuse under **CC BY 4.0**. We attribute the weather display with clickable links to https://api.met.no/ and https://creativecommons.org/licenses/by/4.0/.

The low-traffic web client uses a simple cross-origin request; modern browsers supply the website Origin. Responses are cached by the browser and by a single in-page reader. Requests are limited to **once every three hours** for Portugal, as required for non-Nordic locations. Failed requests are retried with a 15-minute backoff; any last valid forecast is only used for a bounded period.

MET Norway recommends a central caching proxy if traffic increases. If the portfolio receives substantial traffic, move the read through an existing Worker with HTTP caching and an identifying User-Agent; do **not** add a sixth Cloudflare cron.

The source is a forecast model. Do not claim that a model estimate proves it is raining at a particular house. There is no visitor precise location involved.

Provider documents: https://api.met.no/doc/TermsOfService and https://api.met.no/doc/locationforecast/HowTO

## Testing

Default production: https://ricardo19-deve.github.io/

Visual demo is available only with the explicit diagnostics switch, and is **clearly labeled simulated**:

- `?m-debug=1&m-weather-demo=rain` — precipitation, clouds, wind and 3D umbrella
- `?m-debug=1&m-weather-demo=wind` — stronger sideways breeze and tail response
- `?m-debug=1&m-weather-demo=cloud` — moving clouds
- `?m-debug=1&m-weather-demo=sun` — calm weather, no umbrella
- `?m-debug=1&m-weather-demo=snow` — gentle snowfall

The regular `?m-debug=1` without a requested demo remains weather-neutral to preserve exact original-model pixel QA. Demo weather never writes to the model, logs, CRM or server.

Run `node --test m-world*.test.mjs`, plus native Chrome `node m-world-weather-browser.mjs` (Playwright + Chrome required). Production cloud/umbrella behavior still requires physical Safari and weak-device performance inspection.
