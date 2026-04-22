import type { CalendarStop } from '@/types/delivery';
import { getCityCoordinates, calculateDistance } from './geocoding';
import { WAREHOUSE_LOCATION } from './maps';

export interface OptimizedRoute {
  /** Final sequence of stopIds — starting from warehouse, nearest-neighbour. */
  orderedIds: string[];
  /** Total round-trip distance (km), including warehouse start + warehouse end. */
  totalDistance: number;
  /** Stops that were appended at the end because their city is unknown. */
  unresolvableCount: number;
}

/**
 * Greedy nearest-neighbour route optimizer:
 *   warehouse → closest → closest from there → ... → warehouse.
 *
 * Stops without a resolvable city are appended at the end (untouched), so
 * the function never loses data.
 *
 * Precision limit: we currently geocode at CITY level (not street), so stops
 * in the same city will cluster but their intra-city order is arbitrary.
 */
export function optimizeStops(stops: CalendarStop[]): OptimizedRoute {
  const withCoords: {
    stop: CalendarStop;
    coords: { lat: number; lng: number };
  }[] = [];
  const without: CalendarStop[] = [];

  for (const s of stops) {
    const coords = getCityCoordinates(s.city);
    if (coords) withCoords.push({ stop: s, coords });
    else without.push(s);
  }

  if (withCoords.length === 0) {
    return {
      orderedIds: stops.map((s) => s.stopId),
      totalDistance: 0,
      unresolvableCount: without.length,
    };
  }

  const warehouse = {
    lat: WAREHOUSE_LOCATION.lat,
    lng: WAREHOUSE_LOCATION.lng,
  };

  const unvisited = [...withCoords];
  const ordered: CalendarStop[] = [];
  let current = warehouse;
  let totalDistance = 0;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = calculateDistance(current, unvisited[i].coords);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const [picked] = unvisited.splice(nearestIdx, 1);
    ordered.push(picked.stop);
    totalDistance += nearestDist;
    current = picked.coords;
  }

  // Close the loop — return to warehouse
  totalDistance += calculateDistance(current, warehouse);

  return {
    orderedIds: [
      ...ordered.map((s) => s.stopId),
      ...without.map((s) => s.stopId),
    ],
    totalDistance: Math.round(totalDistance),
    unresolvableCount: without.length,
  };
}
