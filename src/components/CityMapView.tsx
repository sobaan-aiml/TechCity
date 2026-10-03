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
  Layers,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { CivicIssue, PriorityLevel } from '../types/civic';
import { getPriorityBadgeClass, getStatusBadgeClass } from '../utils/helpers';
import { safeFetchJson } from '../utils/api';

interface CityMapViewProps {
  onSelectIssue: (trackingId: string) => void;
}

export const CityMapView: React.FC<CityMapViewProps> = ({ onSelectIssue }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);

  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Map view controls
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

    // Center on city coordinates (Metro / Bangalore center 12.9716, 77.5946)
    const map = L.map(mapContainerRef.current, {
      center: [12.965, 77.605],
      zoom: 13,
      zoomControl: true,
    });

    // OpenStreetMap tile layer (No paid API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

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
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          ${
            issue.is_overdue || issue.priority === 'CRITICAL'
              ? `<div style="position: absolute; width: 34px; height: 34px; border-radius: 9999px; background: ${markerColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
              : ''
          }
          <div style="width: 26px; height: 26px; border-radius: 9999px; background: ${
            isResolved ? '#10b981' : markerColor
          }; border: 2.5px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 11px;">
            ${isResolved ? '✓' : issue.affected_people > 1 ? issue.affected_people : '!'}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html,
        className: 'custom-map-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([issue.latitude, issue.longitude], { icon: customIcon });

      // Popup Content (Prompt Requirement: tracking ID, category, priority, status, location)
      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; min-width: 200px;">
          <div style="font-family: monospace; font-weight: 800; color: #1d4ed8; margin-bottom: 2px;">
            ${issue.tracking_id}
          </div>
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: 13px;">
            ${issue.title}
          </div>
          <div style="display: flex; gap: 4px; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #334155;">
              ${issue.category}
            </span>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${
              issue.priority === 'CRITICAL' ? '#fee2e2; color: #991b1b;' : '#fef3c7; color: #92400e;'
            }">
              ${issue.priority}
            </span>
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">
            📍 ${issue.address}
          </div>
          <div style="color: #475569; font-size: 11px; margin-bottom: 8px;">
            Status: <strong>${issue.status}</strong> ${issue.is_overdue ? '<span style="color:#dc2626; font-weight:bold;">(OVERDUE)</span>' : ''}
          </div>
          <button id="btn-track-${issue.tracking_id}" style="width: 100%; background: #2563eb; color: #ffffff; border: none; padding: 6px 10px; border-radius: 6px; font-weight: 600; font-size: 11px; cursor: pointer;">
            View Timeline & Details
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-track-${issue.tracking_id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectIssue(issue.tracking_id);
          };
        }
      });

      marker.on('click', () => {
        setActiveIssue(issue);
      });

      markersLayerRef.current?.addLayer(marker);
    });

    // 2. Add Hotspot Clusters if enabled
    if (showHotspots) {
      const hotspots = [
        {
          name: 'Central Commercial Corridor Hotspot',
          lat: 12.9716,
          lng: 77.5946,
          radius: 600,
          color: '#ef4444',
          count: 'Frequent road void & waste dump reports',
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
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '4, 4',
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
            <span className="text-xs text-slate-500">Live Infrastructure Map</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            City Civic Map & Hotspot Analysis
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            OpenStreetMap visualization of all verified citizen reports with color-coded priority pins and hotspot density rings.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowHotspots(!showHotspots)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition-colors ${
              showHotspots
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-300 text-slate-600'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>{showHotspots ? 'Hotspots Active' : 'Show Hotspots'}</span>
          </button>

          <button
            onClick={fetchIssues}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            title="Refresh map data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-500">Filter Pins:</span>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">🔴 Critical Only</option>
            <option value="HIGH">🟠 High Only</option>
            <option value="MEDIUM">🟡 Medium Only</option>
            <option value="LOW">🔵 Low Only</option>
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
      <div className="relative rounded-2xl overflow-hidden border border-slate-300 shadow-md bg-slate-100 min-h-[560px] h-[65vh]">
        <div ref={mapContainerRef} className="w-full h-full min-h-[560px]" />

        {/* Floating Active Issue Quick Card if selected */}
        {activeIssue && (
          <div className="absolute bottom-5 left-5 right-5 sm:left-auto sm:right-5 sm:w-96 z-1000 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 p-4 shadow-xl text-xs">
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
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1 transition-colors"
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
