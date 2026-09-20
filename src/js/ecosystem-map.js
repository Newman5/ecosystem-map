(function () {
  const OFFICIAL_CLASSES = {
    12: "亞高山針葉林",
    13: "上部山地針葉林",
    14: "上部山地－山地－下部山地次生針葉林",
    15: "山地針葉林",
    16: "上部山地針闊葉混淆林",
    17: "上部山地－山地－下部山地針闊葉次生混淆林",
    18: "山地針闊葉混淆林",
    19: "下部山地針闊葉混淆林",
    20: "上部山地－山地－下部山地崩塌地次生落葉闊葉林",
    21: "山地常綠闊葉林",
    22: "山地常綠闊葉矮林",
    23: "山地落葉闊葉林",
    24: "山地－下部山地－低地次生落葉闊葉林",
    25: "山地－下部山地－低地半落葉闊葉林",
    26: "下部山地常綠闊葉林",
    27: "下部山地－低地次生常綠闊葉林",
    28: "低地常綠闊葉林",
    29: "低地風衝常綠闊葉矮林",
    30: "竹林",
    31: "熱帶海岸林",
    32: "高山針闊葉灌叢",
    33: "亞高山－上部山地－山地針闊葉灌叢",
    34: "下部山地－低地闊葉灌叢",
    35: "海岸闊葉灌叢",
    36: "高山草本植群",
    37: "亞高山－上部山地－山地草本植群",
    38: "下部山地－低地草本植群",
    39: "砂丘植群",
    40: "亞高山－上部山地－山地岩壁及碎石坡植群",
    41: "下部山地－低地岩壁及碎石坡植群",
    42: "海岸岩壁植群",
    43: "人工林",
    44: "耕地",
    45: "建地",
    46: "天然裸露地",
    47: "水域",
    48: "公園、墓地",
    49: "人工裸露地",
  };

  const OFFICIAL_CODE_MIN = 12;
  const ZONE_UNAVAILABLE = "Not available in the bundled raster";
  const ZONE_MATCHERS = [
    ["亞高山", "Subalpine"],
    ["高山", "Alpine"],
    ["上部山地", "Upper montane"],
    ["下部山地", "Lower montane"],
    ["山地", "Montane"],
    ["低地", "Lowland"],
    ["海岸", "Coastal"],
  ];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function describeZone(name) {
    if (!name) return ZONE_UNAVAILABLE;

    for (const [needle, zone] of ZONE_MATCHERS) {
      if (name.includes(needle)) {
        return zone;
      }
    }

    return ZONE_UNAVAILABLE;
  }

  function classColor(name) {
    if (!name) return null;
    if (name.includes("水域")) return "#4f7cff";
    if (name.includes("建地")) return "#676d73";
    if (name.includes("耕地")) return "#c6a766";
    if (name.includes("裸露")) return "#9f8c6f";
    if (name.includes("岩壁")) return "#8f8475";
    if (name.includes("草本")) return "#d9d96b";
    if (name.includes("灌叢")) return "#c68d2d";
    if (name.includes("竹林")) return "#7bbf59";
    if (name.includes("人工林")) return "#3f8f71";
    if (name.includes("混淆林")) return "#5d8f4a";
    if (name.includes("針葉林")) return "#2f6f44";
    if (name.includes("闊葉林")) return "#5aa053";
    return "#4a8d4d";
  }

  function formatPopup(name, sourceName, sourceLabel) {
    const safeName = escapeHtml(name);
    const safeSourceName = escapeHtml(sourceName);
    const safeSourceLabel = escapeHtml(sourceLabel);
    const safeZone = escapeHtml(describeZone(name));

    return `
      <div class="ecosystem-popup">
        <h2>${safeName}</h2>
        <dl>
          <dt>Vegetation / ecosystem class</dt>
          <dd>${safeName}</dd>
          <dt>Official source name</dt>
          <dd>${safeSourceLabel}</dd>
          <dt>Altitudinal zone</dt>
          <dd>${safeZone}</dd>
          <dt>Source</dt>
          <dd>${safeSourceName}</dd>
        </dl>
      </div>
    `;
  }

  function statusText(name, placeName) {
    if (name) {
      return `${placeName ? `${placeName}: ` : ""}${name}`;
    }
    return placeName
      ? `${placeName}: no official vegetation class is available at the exact sampled cell. Try a nearby natural slope.`
      : "No official vegetation class is available at the exact sampled cell. Try a nearby natural slope.";
  }

  function sampleRaster(georaster, latlng) {
    const [band] = georaster.values;
    const row = Math.floor((georaster.ymax - latlng.lat) / georaster.pixelHeight);
    const col = Math.floor((latlng.lng - georaster.xmin) / georaster.pixelWidth);

    if (row < 0 || col < 0 || row >= band.length || col >= band[0].length) {
      return null;
    }

    const value = band[row][col];
    if (!Number.isFinite(value)) {
      return null;
    }

    return Math.round(value);
  }

  async function buildMap(container) {
    const configElement = document.getElementById(`${container.id}-config`);
    const placesElement = document.getElementById(`${container.id}-places`);
    const statusElement = document.getElementById(`${container.id}-status`);

    if (!configElement || !placesElement || !statusElement || typeof parseGeoraster !== "function") {
      return;
    }

    const config = JSON.parse(configElement.textContent);
    const places = JSON.parse(placesElement.textContent);
    const map = L.map(container.id).setView([config.center.lat, config.center.lng], config.zoom);

    const basemaps = {};
    Object.entries(config.basemaps || {}).forEach(([key, tileConfig], index) => {
      basemaps[tileConfig.name] = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom || config.maxZoom || 18,
      });

      if (index === 0) {
        basemaps[tileConfig.name].addTo(map);
      }
    });

    const placesLayer = L.layerGroup();
    places.forEach((place) => {
      L.marker([place.lat, place.lng])
        .bindPopup(`<strong>${place.name}</strong><br>${place.note}`)
        .addTo(placesLayer);
    });
    placesLayer.addTo(map);

    let georaster;
    let vegetationLayer;
    let userMarker;

    const sourceName = config.vegetation.sourceName;
    const sourceLabel = config.vegetation.sourceLabel;

    function inspectLocation(latlng, options = {}) {
      if (!georaster) return;

      const code = sampleRaster(georaster, latlng);
      const className = code !== null && code >= OFFICIAL_CODE_MIN ? OFFICIAL_CLASSES[code] ?? null : null;

      statusElement.textContent = statusText(className, options.placeName);

      if (!className) {
        if (options.keepPopup) {
          L.popup()
            .setLatLng(latlng)
            .setContent("No official vegetation class is available at this exact sampled cell. Try a nearby natural slope.")
            .openOn(map);
        }
        return;
      }

      L.popup()
        .setLatLng(latlng)
        .setContent(formatPopup(className, sourceName, sourceLabel))
        .openOn(map);
    }

    statusElement.textContent = "Loading the bundled Taiwan vegetation raster…";

    const response = await fetch(config.vegetation.rasterUrl);
    if (!response.ok) {
      throw new Error(`Could not load vegetation data (${response.status})`);
    }
    georaster = await parseGeoraster(await response.arrayBuffer());

    vegetationLayer = new GeoRasterLayer({
      georaster,
      opacity: config.vegetation.opacity || 0.75,
      pixelValuesToColorFn: ([value]) => {
        if (value == null || Number.isNaN(value) || value < OFFICIAL_CODE_MIN) {
          return null;
        }

        return classColor(OFFICIAL_CLASSES[Math.round(value)]);
      },
      resolution: 128,
    });

    vegetationLayer.addTo(map);

    const overlays = {
      [config.vegetation.name]: vegetationLayer,
      "Reference places": placesLayer,
    };

    L.control.layers(basemaps, overlays, { collapsed: false }).addTo(map);
    statusElement.textContent = "Vegetation layer ready. Click the map or use Locate me.";

    map.on("click", (event) => inspectLocation(event.latlng, { keepPopup: true }));

    document.querySelectorAll(`[data-map-target="${container.id}"]`).forEach((button) => {
      button.addEventListener("click", () => {
        const lat = Number(button.dataset.lat);
        const lng = Number(button.dataset.lng);
        const zoom = Number(button.dataset.zoom || config.referenceZoom || 11);
        map.setView([lat, lng], zoom);
        inspectLocation({ lat, lng }, { keepPopup: true, placeName: button.textContent.trim() });
      });
    });

    const locateButton = document.querySelector(`[data-locate-map="${container.id}"]`);
    if (locateButton) {
      locateButton.addEventListener("click", () => {
        if (!navigator.geolocation) {
          statusElement.textContent = "Geolocation is not available in this browser.";
          return;
        }

        statusElement.textContent = "Requesting your location…";

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const latlng = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            if (userMarker) {
              userMarker.setLatLng(latlng);
            } else {
              userMarker = L.marker(latlng).addTo(map);
            }

            userMarker.bindPopup("You are here.").openPopup();
            map.setView([latlng.lat, latlng.lng], Math.max(map.getZoom(), 12));
            inspectLocation(latlng, { keepPopup: false, placeName: "Your location" });
          },
          (error) => {
            statusElement.textContent = `Location unavailable: ${error.message}`;
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          }
        );
      });
    }
  }

  document.querySelectorAll(".leaflet-map-canvas").forEach((container) => {
    buildMap(container).catch((error) => {
      const statusElement = document.getElementById(`${container.id}-status`);
      if (statusElement) {
        statusElement.textContent = `Map failed to load: ${error.message}`;
      }
    });
  });
})();
