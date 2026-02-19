import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = "YOUR_MAPBOX_TOKEN";

export default function MapView() {
  const mapRef = useRef(null);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [77.5946, 12.9716],
      zoom: 12
    });

    new mapboxgl.Marker({ color: "#5B6CFF" })
      .setLngLat([77.5946, 12.9716])
      .addTo(map);

    return () => map.remove();
  }, []);

  return <div ref={mapRef} style={{ height: "100%", width: "100%" }} />;
}
