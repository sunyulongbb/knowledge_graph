# Natural Earth source data

Downloaded for this offline basemap from the Natural Earth maintainers' repository:

- https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
- https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson
- https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places.geojson (Chinese names joined by `NE_ID`)

License: public domain. Terms: https://www.naturalearthdata.com/about/terms-of-use/

Rebuild local tiles and labels using `python scripts/build-offline-map.py` from the repository root. The supplied data is a cartographic reference, not a street map or a complete worldwide city registry.
