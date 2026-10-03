import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertTriangle,
  Building2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Globe2,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  RefreshCw,
  Satellite,
  Sparkles,
  Users,
} from 'lucide-react';
import { CivicIssue, PriorityLevel } from '../types/civic';
import { getPriorityBadgeClass, getStatusBadgeClass } from '../utils/helpers';
import { safeFetchJson } from '../utils/api';

type MapViewType = 'satellite' | 'streets' | 'pure_satellite';

const TILE_PROVIDERS: Record<
  MapViewType,
  { name: string; url: string; maxZoom: number; attribution: string }
> = {
  satellite: {
    name: 'Google Satellite (Hybrid)',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20,
    attribution: 'Imagery © Google Maps Satellite',
  },
  streets: {
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  },
  pure_satellite: {
    name: 'Esri Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: '© Esri World Imagery',
  },
};

interface CityMapViewProps {
  onSelectIssue: (trackingId: string) => void;
}

export const CityMapView: React.FC<CityMapViewProps> = ({ onSelectIssue }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);

  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Map view controls
  const [mapType, setMapType] = useState<MapViewType>('satellite');
  const [showHotspots, setShowHotspots] = useState(true);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [activeIssue, setActiveIssue] = useState<CivicIssue | null>(null);

  // Fetch all issues for the map
  const fetchIssues = async () => {
    setIsLoading(true);
    try {
      const res = await safeFetchJson<{ issues: CivicIssue[] }>('/api/issues');
      if (res.success && res.data?.issues) {
        setIssues(res.data.issues);
      }
    } catch (err) {
      console.error('Failed to load map issues:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    // Center on city coordinates (Metro / Bangalore center 12.965, 77.605)
    const map = L.map(mapContainerRef.current, {
      center: [12.965, 77.605],
      zoom: 13,
      zoomControl: true,
    });

    // Initial tile layer (Google Satellite Hybrid by default)
    const initialConfig = TILE_PROVIDERS['satellite'];
    const initialTile = L.tileLayer(initialConfig.url, {
      maxZoom: initialConfig.maxZoom,
      attribution: initialConfig.attribution,
    }).addTo(map);

    currentTileLayerRef.current = initialTile;
    markersLayerRef.current = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Dynamic Tile Switching (Satellite vs Streets vs Pure Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const config = TILE_PROVIDERS[mapType];
    const newTile = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      attribution: config.attribution,
    });

    newTile.addTo(map);
    newTile.bringToBack();
    currentTileLayerRef.current = newTile;
  }, [mapType]);

  // Fit all issues in view
  const handleFitAllIssues = () => {
    if (!mapInstanceRef.current || !issues.length) return;
    const validCoords = issues
      .filter((i) => i.latitude && i.longitude)
      .map((i) => [i.latitude, i.longitude] as [number, number]);

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  };

  // Re-center on Downtown
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([12.965, 77.605], 13);
  };

  // Render markers and hotspots when issues, filter, or toggles change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !hotspotsLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    hotspotsLayerRef.current.clearLayers();

    // Filter issues
    const filtered = issues.filter((issue) => {
      if (filterPriority !== 'ALL' && issue.priority !== filterPriority) return false;
      if (filterStatus !== 'ALL' && issue.status !== filterStatus) return false;
      return true;
    });

    // 1. Add Issue Markers
    filtered.forEach((issue) => {
      if (!issue.latitude || !issue.longitude) return;

      const markerColor =
        issue.priority === 'CRITICAL'
          ? '#ef4444'
          : issue.priority === 'HIGH'
          ? '#f97316'
          : issue.priority === 'MEDIUM'
          ? '#eab308'
          : '#3b82f6';

      const isResolved = issue.status === 'Resolved & Verified';

      const html = `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${
            issue.is_overdue || issue.priority === 'CRITICAL'
              ? `<div style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; background: ${markerColor}; opacity: 0.45; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
              : ''
          }
          <div style="width: 28px; height: 28px; border-radius: 9999px; background: ${
            isResolved ? '#10b981' : markerColor
          }; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 11px;">
            ${isResolved ? '✓' : issue.affected_people > 1 ? issue.affected_people : '!'}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html,
        className: 'custom-map-pin',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([issue.latitude, issue.longitude], { icon: customIcon });

      // Popup Content (Prompt Requirement: tracking ID, category, priority, status, location)
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 220px; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            <strong style="color: #2563eb; font-size: 13px; font-family: monospace;">${issue.tracking_id}</strong>
            <span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #334155;">
              ${issue.priority}
            </span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            ${issue.title}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 6px; line-height: 1.3;">
            ${issue.description.slice(0, 90)}...
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            📍 ${issue.address}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
            <span>Status: <strong style="color: #0f172a;">${issue.status}</strong></span>
            <span>👥 ${issue.affected_people} impacted</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 300 });

      marker.on('click', () => {
        setActiveIssue(issue);
      });

      markersLayerRef.current?.addLayer(marker);
    });

    // 2. Add Hotspot Density Rings if toggled
    if (showHotspots) {
      const hotspots = [
        {
          name: 'Central Commercial Market Area',
          lat: 12.9698,
          lng: 77.5935,
          radius: 650,
          color: '#ef4444',
          count: 'Frequent solid waste dumping & road potholes',
        },
        {
          name: 'North Ring Road Transit Underpass',
          lat: 12.9845,
          lng: 77.6092,
          radius: 500,
          color: '#f97316',
          count: 'Recurring waterlogging & stormwater choke',
        },
        {
          name: 'IT Corridor Boulevard Sector',
          lat: 12.9355,
          lng: 77.6245,
          radius: 550,
          color: '#eab308',
          count: 'Broken streetlight & cabling cluster',
        },
      ];

      hotspots.forEach((spot) => {
        const circle = L.circle([spot.lat, spot.lng], {
          radius: spot.radius,
          color: spot.color,
          fillColor: spot.color,
          fillOpacity: 0.18,
          weight: 2,
          dashArray: '5, 5',
        });

        circle.bindTooltip(`<strong>${spot.name}</strong><br/>${spot.count}`, {
          sticky: true,
        });

        hotspotsLayerRef.current?.addLayer(circle);
      });
    }
  }, [issues, filterPriority, filterStatus, showHotspots]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Map Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              GEOSPATIAL INTELLIGENCE
            </span>
            <span className="text-xs text-slate-500">Google Satellite & Street View</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            City Civic Map & Hotspot Analysis
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            High-resolution satellite view with color-coded priority pins, pulsing hazard rings, and ward hotspot density zones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Fit Bounds Button */}
          <button
            onClick={handleFitAllIssues}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-2xs"
            title="Fit all reported issues on screen"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Fit All Issues</span>
          </button>

          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-2xs"
            title="Recenter on city center"
          >
            <Navigation className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Center</span>
          </button>

          {/* Hotspots Toggle */}
          <button
            onClick={() => setShowHotspots(!showHotspots)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition-colors shadow-2xs ${
              showHotspots
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-300 text-slate-600'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>{showHotspots ? 'Hotspots On' : 'Show Hotspots'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchIssues}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh map data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter & View Mode Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="Reported">Reported</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolution Submitted">Resolution Submitted</option>
            <option value="Resolved & Verified">Resolved & Verified</option>
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] text-slate-600">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Critical</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>High</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Resolved</span>
          </div>
        </div>
      </div>

      {/* MAP CANVAS CONTAINER */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-300 shadow-xl bg-slate-900 min-h-[580px] h-[68vh]">
        {/* Leaflet Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full min-h-[580px]" />

        {/* FLOATING GOOGLE MAPS STYLE MAP/SATELLITE SWITCHER */}
        <div className="absolute top-4 right-4 z-1000 bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-slate-200 flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all ${
              mapType === 'satellite'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Google Satellite imagery with road and landmark names"
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Satellite (Google)</span>
          </button>

          <button
            type="button"
            onClick={() => setMapType('streets')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all ${
              mapType === 'streets'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Street cartography"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Streets</span>
          </button>

          <button
            type="button"
            onClick={() => setMapType('pure_satellite')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all hidden sm:flex ${
              mapType === 'pure_satellite'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
            title="Esri high-resolution aerial imagery"
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Pure Aerial</span>
          </button>
        </div>

        {/* Floating Active Issue Quick Card if selected */}
        {activeIssue && (
          <div className="absolute bottom-5 left-5 right-5 sm:left-auto sm:right-5 sm:w-96 z-1000 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 p-4 shadow-2xl text-xs animate-in fade-in duration-200">
            <div className="flex items-start justify-between mb-1.5">
              <div>
                <span className="font-mono font-bold text-blue-700">{activeIssue.tracking_id}</span>
                <span
                  className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadgeClass(
                    activeIssue.priority
                  )}`}
                >
                  {activeIssue.priority}
                </span>
                <span
                  className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeClass(
                    activeIssue.status
                  )}`}
                >
                  {activeIssue.status}
                </span>
              </div>
              <button
                onClick={() => setActiveIssue(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <h4 className="font-bold text-slate-900 text-sm mb-1">{activeIssue.title}</h4>
            <p className="text-slate-600 line-clamp-2 mb-2">{activeIssue.description}</p>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>{activeIssue.affected_people} affected</span>
              </span>
              <button
                onClick={() => onSelectIssue(activeIssue.tracking_id)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1 transition-colors shadow-2xs"
              >
                <span>Track Full Issue</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
