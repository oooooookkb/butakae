"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Task } from "@/types";
import { CATEGORY_EMOJI, formatPrice, timeAgo } from "@/lib/data";

interface MapViewProps {
  tasks: Task[];
  userLat: number;
  userLng: number;
  onTaskSelect?: (task: Task) => void;
  selectedCategory?: string;
}

export default function MapView({ tasks, userLat, userLng, onTaskSelect, selectedCategory = "전체" }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // 지도 초기화
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([userLat, userLng], 14);

    // OpenStreetMap 타일 (무료, 키 불필요)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
      maxZoom: 18,
    }).addTo(map);

    // 줌 컨트롤 우측 하단
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // 내 위치 마커
    const userIcon = L.divIcon({
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#00C9A7;border:3px solid white;box-shadow:0 2px 8px rgba(0,201,167,0.5)"></div>`,
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([userLat, userLng], { icon: userIcon })
      .addTo(map)
      .bindTooltip("내 위치", { direction: "top", offset: [0, -12] });

    // 내 위치 주변 반경 원
    L.circle([userLat, userLng], {
      radius: 2000, // 2km
      color: "#00C9A7",
      fillColor: "#00C9A7",
      fillOpacity: 0.06,
      weight: 1,
      dashArray: "5,5",
    }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마커 업데이트
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    const filtered = selectedCategory === "전체"
      ? tasks
      : tasks.filter((t) => t.category === selectedCategory);

    filtered.forEach((task) => {
      const lat = (task as any).lat;
      const lng = (task as any).lng;
      if (!lat || !lng) return;

      const emoji = CATEGORY_EMOJI[task.category] || "📍";
      const isUrgent = task.is_urgent;

      const icon = L.divIcon({
        html: `
          <div style="
            position:relative;
            width:40px;height:40px;
            display:flex;align-items:center;justify-content:center;
            font-size:22px;
            background:white;
            border-radius:12px;
            border:2px solid ${isUrgent ? "#FF6B6B" : "#00C9A7"};
            box-shadow:0 2px 8px rgba(0,0,0,0.15);
            cursor:pointer;
          ">
            ${emoji}
            ${isUrgent ? '<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:#FF6B6B;border:2px solid white"></div>' : ""}
          </div>
        `,
        className: "",
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(markersRef.current!);

      // 팝업
      const popup = L.popup({
        closeButton: false,
        className: "custom-popup",
        maxWidth: 240,
        offset: [0, -35],
      }).setContent(`
        <div style="font-family:'Noto Sans KR',sans-serif;padding:2px">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
            <span style="font-size:10px;font-weight:700;color:${isUrgent ? "#FF6B6B" : "#00C9A7"};background:${isUrgent ? "rgba(255,107,107,0.1)" : "rgba(0,201,167,0.1)"};padding:2px 6px;border-radius:8px">
              ${task.category}
            </span>
            ${isUrgent ? '<span style="font-size:9px;color:#FF6B6B;font-weight:700">⚡ 급함</span>' : ""}
          </div>
          <p style="font-size:13px;font-weight:800;margin:0 0 4px 0;line-height:1.3">${task.title}</p>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:#9A9AB0">📍 ${task.location}</span>
            <span style="font-size:13px;font-weight:900;color:#FF6B6B">${formatPrice(task.price)}</span>
          </div>
        </div>
      `);

      marker.bindPopup(popup);
      marker.on("click", () => {
        if (onTaskSelect) onTaskSelect(task);
      });
    });
  }, [tasks, selectedCategory, onTaskSelect]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: "400px" }} />
  );
}
