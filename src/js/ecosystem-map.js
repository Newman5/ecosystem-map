(function () {
  const OFFICIAL_CODE_MIN = 12;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatPopup(classification, sourceName) {
    const safeEnglishName = escapeHtml(classification.englishName);
    const safeOfficialName = escapeHtml(classification.officialName);
    const safeFamily = escapeHtml(classification.family);
    const safeDerivedZone = escapeHtml(classification.derivedAltitudinalZone);
    const safeSourceName = escapeHtml(sourceName);

    return `
      <div class="ecosystem-popup">
        <p class="ecosystem-popup-kicker">Plain-language name</p>
        <h2>${safeEnglishName}</h2>
        <dl>
          <dt>Official classification</dt>
          <dd>${safeOfficialName}</dd>
          <dt>Ecological family</dt>
          <dd>${safeFamily}</dd>
          <dt>Derived altitudinal zone</dt>
          <dd>${safeDerivedZone}</dd>
          <dt>Source</dt>
          <dd>${safeSourceName}</dd>
        </dl>
      </div>
    `;
  }

  function statusText(classification, placeName) {
    if (classification) {
      return `${placeName ? `${placeName}: ` : ""}${classification.englishName} / ${classification.officialName}`;
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

  function sameFilter(a, b) {
    return a.type === b.type && a.code === b.code && a.familyKey === b.familyKey;
  }

  async function buildMap(container) {
    const configElement = document.getElementById(`${container.id}-config`);
    const placesElement = document.getElementById(`${container.id}-places`);
    const vegetationElement = document.getElementById(`${container.id}-vegetation`);
    const statusElement = document.getElementById(`${container.id}-status`);

    if (!configElement || !placesElement || !vegetationElement || !statusElement || typeof parseGeoraster !== "function") {
      return;
    }

    const config = JSON.parse(configElement.textContent);
    const places = JSON.parse(placesElement.textContent);
    const vegetationClasses = JSON.parse(vegetationElement.textContent);
    const vegetationByCode = new Map(vegetationClasses.map((item) => [item.code, item]));
    const familyCodeMap = vegetationClasses.reduce((map, item) => {
      if (!map.has(item.familyKey)) {
        map.set(item.familyKey, new Set());
      }

      map.get(item.familyKey).add(item.code);
      return map;
    }, new Map());

    const legendButtons = Array.from(document.querySelectorAll(`[data-map-legend="${container.id}"]`));
    const map = L.map(container.id).setView([config.center.lat, config.center.lng], config.zoom);

    const basemaps = {};
    const defaultBasemapKey = Object.keys(config.basemaps || {})[0];

    Object.entries(config.basemaps || {}).forEach(([key, tileConfig]) => {
      basemaps[tileConfig.name] = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom || config.maxZoom || 18,
      });

      if (key === defaultBasemapKey) {
        basemaps[tileConfig.name].addTo(map);
      }
    });

    const placesLayer = L.layerGroup();
    places.forEach((place) => {
      const safePlaceName = escapeHtml(place.name);
      const safePlaceNote = escapeHtml(place.note);

      L.marker([place.lat, place.lng])
        .bindPopup(`<strong>${safePlaceName}</strong><br>${safePlaceNote}`)
        .addTo(placesLayer);
    });
    placesLayer.addTo(map);

    let georaster;
    let vegetationLayer;
    let userMarker;
    let activeFilter = { type: "all", code: null, familyKey: null };

    const sourceName = config.vegetation.sourceName;

    function activeCodeSet() {
      if (activeFilter.type === "class" && activeFilter.code !== null) {
        return new Set([activeFilter.code]);
      }

      if (activeFilter.type === "family" && activeFilter.familyKey) {
        return familyCodeMap.get(activeFilter.familyKey) || new Set();
      }

      return null;
    }

    function classIsVisible(code) {
      const visibleCodes = activeCodeSet();
      return visibleCodes ? visibleCodes.has(code) : true;
    }

    function updateLegendState() {
      legendButtons.forEach((button) => {
        const buttonType = button.dataset.filterType;
        let isActive = false;

        if (buttonType === "all") {
          isActive = activeFilter.type === "all";
        } else if (buttonType === "class") {
          isActive = activeFilter.type === "class" && Number(button.dataset.code) === activeFilter.code;
        } else if (buttonType === "family") {
          isActive = activeFilter.type === "family" && button.dataset.family === activeFilter.familyKey;
        }

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    function setFilter(nextFilter) {
      activeFilter = nextFilter;

      if (vegetationLayer) {
        vegetationLayer.redraw();
      }

      updateLegendState();

      if (activeFilter.type === "all") {
        statusElement.textContent = "Showing all vegetation classes. Click the map or use Locate me.";
        return;
      }

      if (activeFilter.type === "class") {
        const classification = vegetationByCode.get(activeFilter.code);
        statusElement.textContent = classification
          ? `Showing only ${classification.englishName} / ${classification.officialName}.`
          : "Showing a single vegetation class.";
        return;
      }

      if (activeFilter.type === "family") {
        const family = vegetationClasses.find((item) => item.familyKey === activeFilter.familyKey);
        statusElement.textContent = family
          ? `Showing only ${family.family}.`
          : "Showing one ecological family.";
      }
    }

    function inspectLocation(latlng, options = {}) {
      if (!georaster) return;

      const code = sampleRaster(georaster, latlng);
      const classification = code !== null && code >= OFFICIAL_CODE_MIN ? vegetationByCode.get(code) ?? null : null;

      statusElement.textContent = statusText(classification, options.placeName);

      if (!classification) {
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
        .setContent(formatPopup(classification, sourceName))
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
        if (!Number.isFinite(value) || value < OFFICIAL_CODE_MIN) {
          return null;
        }

        const roundedValue = Math.round(value);
        const classification = vegetationByCode.get(roundedValue);
        if (!classification || !classIsVisible(roundedValue)) {
          return null;
        }

        return classification.color;
      },
      resolution: 128,
    });

    vegetationLayer.addTo(map);

    const overlays = {
      [config.vegetation.name]: vegetationLayer,
      "Reference places": placesLayer,
    };

    L.control.layers(basemaps, overlays, { collapsed: false }).addTo(map);
    updateLegendState();
    statusElement.textContent = "Showing all vegetation classes. Click the map, tap the legend, or use Locate me.";

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

    legendButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const filterType = button.dataset.filterType;

        if (filterType === "all") {
          setFilter({ type: "all", code: null, familyKey: null });
          return;
        }

        if (filterType === "class") {
          const code = Number(button.dataset.code);
          const nextFilter = { type: "class", code, familyKey: null };
          setFilter(sameFilter(activeFilter, nextFilter) ? { type: "all", code: null, familyKey: null } : nextFilter);
          return;
        }

        if (filterType === "family") {
          const familyKey = button.dataset.family;
          const nextFilter = { type: "family", code: null, familyKey };
          setFilter(sameFilter(activeFilter, nextFilter) ? { type: "all", code: null, familyKey: null } : nextFilter);
        }
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

            map.setView([latlng.lat, latlng.lng], Math.max(map.getZoom(), 12));
            inspectLocation(latlng, { keepPopup: true, placeName: "Your location" });
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
