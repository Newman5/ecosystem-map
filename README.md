# ecosystem-map

A small field-friendly experiment that tries to answer:

> I’m hiking here — what ecosystem am I in?

The Taiwan prototype uses Leaflet plus a bundled local vegetation raster so the site can deploy as a static GitHub Pages app with no backend, database, account, or API key.

## What this MVP does

- centers a zoomable map on Taiwan
- uses Leaflet with OpenStreetMap as the default basemap
- adds an alternate Taiwan topographic basemap from the National Land Surveying and Mapping Center
- overlays a Taiwan vegetation / ecosystem layer
- lets you click the map to inspect the vegetation class at that location
- includes a **Locate me** button that drops a user marker and identifies the class at the current point when possible
- includes quick-jump reference places for:
  - Lalashan / 拉拉山
  - Baling / 巴陵
  - Puli / 埔里
  - Qingjing / 清境
  - Hehuanshan / 合歡山

## Data source

### Vegetation / ecosystem layer

The MVP vegetation layer is a **local static GeoTIFF** at `/data/taiwan-vegetation-mvp.tif`.

It is based on the official Taiwan vegetation classification schema used by the Forestry and Nature Conservation Agency dataset commonly distributed as:

- **臺灣現生天然植群圖**
- source layer identifier seen in public mirrors: **ACO0301000011021**
- official source fields include values such as `FORMATION`, `CLASS`, `SUBCLASS`, `ALTI_ZONE`, and `AREA_HA`

For this static-hosted MVP, the browser-friendly raster preserves the official `FORMATION` classes used in the source dataset and hides non-official fallback classes in the map overlay.

### Basemaps

- **OpenStreetMap** — default basemap
- **Taiwan EMAP WMTS** — National Land Surveying and Mapping Center (`wmts.nlsc.gov.tw`)

## Why the data is stored locally

Before implementation, the likely official delivery paths were investigated:

- ArcGIS / MapServer / FeatureServer style services
- WMS / WMTS services
- direct browser loading of official vector data
- downloaded-and-converted public data

For a static GitHub Pages MVP, a local converted dataset is the simplest dependable option because:

- live raster services are easy to show but do not reliably expose click-friendly polygon attributes
- live vector delivery from the official source was not the simplest static-site path available in this environment
- a local bundle avoids API keys, accounts, backend code, and CORS surprises

## Attribution and licensing

This project should keep attribution visible when deployed:

- **Vegetation classification source:** Taiwan Forestry and Nature Conservation Agency / 林業及自然保育署
- **Taiwan topo basemap:** National Land Surveying and Mapping Center / 內政部國土測繪中心
- **Default basemap:** © OpenStreetMap contributors

If you replace the bundled raster with a newer official export, keep the same visible attribution and verify any additional license terms attached to that source download.

## Run locally

```bash
npm install
npm start
```

Then open the local Eleventy site, usually:

```text
http://localhost:8080/
```

## Build

```bash
npm run build
```

The static site is generated into `_site/`.

## GitHub Pages deployment

This repo builds to plain static files, so GitHub Pages deployment can use the generated `_site` output from an Actions workflow or any equivalent static publish step.

Typical approach:

1. run `npm ci`
2. run `npm run build`
3. publish `_site/`

## Known limitations

- The vegetation layer is raster-based for MVP simplicity, so inspection is cell-based rather than true polygon popups.
- The overlay intentionally hides non-official fallback classes that may exist in the bundled raster outside the official vegetation class range.
- The current popup focuses on the official classification label; it does not yet expose every source attribute from the original polygon dataset.
- Browser geolocation depends on user permission and HTTPS in production.
- A future data refresh should replace the bundled raster with a directly generated export from the official source archive.

## Future direction

Taiwan is dataset #1, not the final scope.

The long-term goal is a reusable pattern:

> location + authoritative ecological GIS data + a simple field-friendly map

The architecture should be able to swap in other regional datasets — Alaska or elsewhere — without rewriting the core map interaction model.
