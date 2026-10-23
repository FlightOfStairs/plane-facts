import { useEffect, useMemo } from "react";
import { divIcon, latLngBounds } from "leaflet";
import type { LatLngTuple } from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLon, Scenario } from "./offTrack";
import { chartPrep, destinationPoint } from "./offTrack";

const TRACK_COLOR = "#c2185b";
const PREP_COLOR = "#37474f";
const AIRCRAFT_COLOR = "#0d47a1";
const ANSWER_COLOR = "#2e7d32";
/** Length of the drawn heading vector. */
const HEADING_VECTOR_NM = 6;

const tuple = (p: LatLon): LatLngTuple => [p.lat, p.lon];

function textIcon(text: string) {
  return divIcon({
    className: "",
    html: `<span style="font: 600 11px Roboto, sans-serif; color: ${PREP_COLOR}; text-shadow: 0 0 3px #fff, 0 0 3px #fff;">${text}</span>`,
    iconSize: [16, 14],
    iconAnchor: [8, 7],
  });
}

function aircraftIcon(headingDeg: number) {
  // Top-down light aircraft pointing up (north), rotated to the flown heading.
  return divIcon({
    className: "",
    html: `<svg width="30" height="30" viewBox="-15 -15 30 30" style="transform: rotate(${headingDeg}deg); overflow: visible">
      <path d="M0,-13 L1.6,-9 L1.6,-3 L13,0 L13,2.5 L1.6,1.5 L1.2,8 L5,10 L5,12 L0,11 L-5,12 L-5,10 L-1.2,8 L-1.6,1.5 L-13,2.5 L-13,0 L-1.6,-3 L-1.6,-9 Z"
        fill="${AIRCRAFT_COLOR}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const destinationIcon = divIcon({
  className: "",
  html: `<svg width="26" height="26" viewBox="-13 -13 26 26"><circle r="10" fill="none" stroke="${TRACK_COLOR}" stroke-width="2.5"/><circle r="2" fill="${TRACK_COLOR}"/></svg>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const departureIcon = divIcon({
  className: "",
  html: `<svg width="26" height="26" viewBox="-13 -13 26 26"><path d="M0,-11 L9.5,5.5 L-9.5,5.5 Z" fill="none" stroke="${TRACK_COLOR}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Refits the view whenever a new leg is drawn. */
function FitLeg(props: { scenario: Scenario }) {
  const map = useMap();
  const { departure, destination } = props.scenario;
  useEffect(() => {
    map.fitBounds(latLngBounds([tuple(departure), tuple(destination)]), { padding: [40, 40] });
  }, [map, departure, destination]);
  return null;
}

/**
 * The drill's chart: OSM base map, the planned leg with its fan lines and
 * distance bars, and the aircraft drawn on its flown heading. Once answered,
 * the track actually made good and the line to the answer's target (the
 * destination, or the rejoin point when regaining track) are added.
 */
export function OffTrackMap(props: { scenario: Scenario; revealed: boolean }) {
  const { scenario, revealed } = props;
  const prep = useMemo(() => chartPrep(scenario.departure, scenario.destination), [scenario]);
  const headingTip = destinationPoint(scenario.aircraft, scenario.flownHeading, HEADING_VECTOR_NM);

  return (
    <MapContainer center={tuple(scenario.departure)} zoom={9} style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitLeg scenario={scenario} />
      {prep.fanLines.map((s, i) => (
        <Polyline key={`fan${i}`} positions={[tuple(s.from), tuple(s.to)]} pathOptions={{ color: PREP_COLOR, weight: 1.5, opacity: 0.9 }} />
      ))}
      {prep.bars.map((s, i) => (
        <Polyline key={`bar${i}`} positions={[tuple(s.from), tuple(s.to)]} pathOptions={{ color: PREP_COLOR, weight: 1.5 }} />
      ))}
      {prep.labels.map((l, i) => (
        <Marker key={`label${i}`} position={tuple(l.at)} icon={textIcon(l.text)} interactive={false} keyboard={false} />
      ))}
      <Polyline positions={[tuple(scenario.departure), tuple(scenario.destination)]} pathOptions={{ color: TRACK_COLOR, weight: 4, opacity: 0.85 }} />
      <Marker position={tuple(scenario.departure)} icon={departureIcon} interactive={false} keyboard={false} />
      <Marker position={tuple(scenario.destination)} icon={destinationIcon} interactive={false} keyboard={false} />
      {revealed && (
        <>
          <Polyline positions={[tuple(scenario.departure), tuple(scenario.aircraft)]} pathOptions={{ color: AIRCRAFT_COLOR, weight: 2, dashArray: "6 6" }} />
          <Polyline positions={[tuple(scenario.aircraft), tuple(scenario.target)]} pathOptions={{ color: ANSWER_COLOR, weight: 3 }} />
          {scenario.technique === "double" && <CircleMarker center={tuple(scenario.target)} radius={5} pathOptions={{ color: ANSWER_COLOR, fillColor: ANSWER_COLOR, fillOpacity: 1 }} />}
        </>
      )}
      <Polyline positions={[tuple(scenario.aircraft), tuple(headingTip)]} pathOptions={{ color: AIRCRAFT_COLOR, weight: 2, dashArray: "2 5" }} />
      <Marker position={tuple(scenario.aircraft)} icon={aircraftIcon(scenario.flownHeading)} interactive={false} keyboard={false} />
    </MapContainer>
  );
}
