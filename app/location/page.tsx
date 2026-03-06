"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";

declare global {
  interface Window {
    daum: any;
  }
}

export default function LocationPage() {
  const router = useRouter();
  const [currentLocation, setCurrentLocation] = useState("");
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    location: string;
    lat: number;
    lng: number;
    fullAddress: string;
  } | null>(null);
  const [postcodeLoaded, setPostcodeLoaded] = useState(false);

  useEffect(() => {
    // Daum Postcode 스크립트 로드 (무료, 키 불필요)
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.onload = () => setPostcodeLoaded(true);
    document.head.appendChild(script);

    // 현재 프로필 로드
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("location, lat, lng")
        .eq("id", user.id)
        .single();
      if (profile) {
        setCurrentLocation(profile.location ?? "");
        setCurrentLat(profile.lat);
        setCurrentLng(profile.lng);
      }
    };
    init();
  }, []);

  // GPS 자동 감지
  const detectGPS = async () => {
    if (!navigator.geolocation) {
      alert("이 브라우저는 GPS를 지원하지 않습니다.");
      return;
    }
    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Nominatim 역 지오코딩 (무료, OpenStreetMap)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ko&addressdetails=1`,
            { headers: { "User-Agent": "Butakae/1.0" } }
          );
          const data = await res.json();
          const addr = data.address;

          // 한국 주소 구성
          const dong = addr.borough || addr.suburb || addr.neighbourhood || "";
          const gu = addr.city_district || addr.county || "";
          const city = addr.city || addr.town || addr.village || "";
          const locationName = dong || gu || city || "내 위치";
          const fullAddress = [city, gu, dong].filter(Boolean).join(" ") || data.display_name || "내 위치";

          setSearchResult({
            location: locationName,
            lat: latitude,
            lng: longitude,
            fullAddress,
          });
        } catch {
          setSearchResult({
            location: "내 위치",
            lat: latitude,
            lng: longitude,
            fullAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          });
        }
        setGpsLoading(false);
      },
      (error) => {
        setGpsLoading(false);
        if (error.code === 1) {
          alert("위치 권한을 허용해주세요.\n\n브라우저 설정에서 위치 접근을 허용한 뒤 다시 시도해주세요.");
        } else if (error.code === 2) {
          alert("위치 정보를 가져올 수 없습니다. GPS가 켜져 있는지 확인해주세요.");
        } else {
          alert("위치 요청 시간이 초과되었습니다. 다시 시도해주세요.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Daum Postcode 주소 검색
  const openAddressSearch = () => {
    if (!window.daum?.Postcode) {
      alert("주소 검색을 로딩 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: async (data: any) => {
        const address = data.roadAddress || data.jibunAddress || data.address;
        const dong = data.bname || data.bname2 || "";
        const sigungu = data.sigungu || "";
        const sido = data.sido || "";
        const locationName = dong || sigungu;
        const fullAddress = [sido, sigungu, dong].filter(Boolean).join(" ");

        // Nominatim으로 좌표 얻기
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=ko&countrycodes=kr`,
            { headers: { "User-Agent": "Butakae/1.0" } }
          );
          const results = await res.json();
          if (results.length > 0) {
            setSearchResult({
              location: locationName,
              lat: parseFloat(results[0].lat),
              lng: parseFloat(results[0].lon),
              fullAddress,
            });
          } else {
            setSearchResult({ location: locationName, lat: 0, lng: 0, fullAddress });
          }
        } catch {
          setSearchResult({ location: locationName, lat: 0, lng: 0, fullAddress });
        }
      },
    }).open();
  };

  // 위치 저장
  const saveLocation = async () => {
    if (!searchResult) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({
        location: searchResult.location,
        lat: searchResult.lat,
        lng: searchResult.lng,
      })
      .eq("id", user.id);

    setSaving(false);
    router.push("/");
  };

  const LocationContent = () => (
    <div className="max-w-xl mx-auto">
      {/* 현재 위치 */}
      {currentLocation && (
        <div className="bg-gradient-to-r from-mint/10 to-sky/10 rounded-2xl p-5 mb-5 border border-mint/15">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-mint/15 flex items-center justify-center text-2xl">📍</div>
            <div className="flex-1">
              <p className="text-xs text-brand-light font-medium">현재 설정된 동네</p>
              <p className="text-lg font-black text-mint-dark">{currentLocation}</p>
              {currentLat && currentLng && (
                <p className="text-[10px] text-brand-light mt-0.5">
                  좌표: {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
                </p>
              )}
            </div>
            <span className="text-2xl">✅</span>
          </div>
        </div>
      )}

      {/* GPS 자동 감지 */}
      <div className="bg-white rounded-2xl border border-mint/10 p-5 mb-4">
        <h3 className="text-sm font-bold mb-3">📡 현재 위치 자동 감지</h3>
        <p className="text-xs text-brand-light mb-4">
          GPS를 사용해서 현재 위치를 자동으로 찾아줘요. 가장 정확한 방법이에요.
        </p>
        <button
          onClick={detectGPS}
          disabled={gpsLoading}
          className="w-full bg-gradient-to-r from-mint to-sky text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {gpsLoading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              위치 찾는 중...
            </>
          ) : (
            <>📍 현재 위치 사용하기</>
          )}
        </button>
      </div>

      {/* 주소 검색 */}
      <div className="bg-white rounded-2xl border border-mint/10 p-5 mb-4">
        <h3 className="text-sm font-bold mb-3">🔍 주소로 검색하기</h3>
        <p className="text-xs text-brand-light mb-4">
          도로명 주소나 지번 주소를 검색해서 동네를 설정할 수 있어요.
        </p>
        <button
          onClick={openAddressSearch}
          disabled={!postcodeLoaded}
          className="w-full border-2 border-dashed border-mint/30 bg-mint/5 text-mint-dark py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:border-mint/50 transition-colors disabled:opacity-60"
        >
          🏠 주소 검색하기
        </button>
      </div>

      {/* 검색 결과 */}
      {searchResult && (
        <div className="bg-white rounded-2xl border-2 border-mint p-5 mb-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <h3 className="text-sm font-black">선택한 위치</h3>
          </div>
          <div className="bg-bg rounded-xl p-4 mb-4">
            <p className="text-lg font-black text-brand-text mb-1">{searchResult.location}</p>
            <p className="text-xs text-brand-light">{searchResult.fullAddress}</p>
            {searchResult.lat > 0 && (
              <p className="text-[10px] text-brand-light mt-1">
                좌표: {searchResult.lat.toFixed(4)}, {searchResult.lng.toFixed(4)}
              </p>
            )}
          </div>
          <button
            onClick={saveLocation}
            disabled={saving}
            className="w-full bg-gradient-to-r from-coral to-coral-dark text-white py-3.5 rounded-2xl font-bold text-sm shadow-coral active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? "저장 중..." : "✅ 이 위치로 설정하기"}
          </button>
        </div>
      )}

      {/* 빠른 선택 (인기 동네) */}
      <div className="bg-white rounded-2xl border border-mint/10 p-5">
        <h3 className="text-sm font-bold mb-3">⚡ 빠른 선택</h3>
        <p className="text-xs text-brand-light mb-3">자주 쓰는 동네를 빠르게 선택할 수 있어요.</p>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "강남구", lat: 37.4979, lng: 127.0276 },
            { name: "서초구", lat: 37.4837, lng: 127.0324 },
            { name: "영통구", lat: 37.2636, lng: 127.0286 },
            { name: "분당구", lat: 37.3825, lng: 127.1188 },
            { name: "판교", lat: 37.3948, lng: 127.1112 },
            { name: "해운대구", lat: 35.1631, lng: 129.1635 },
            { name: "마포구", lat: 37.5563, lng: 126.9082 },
            { name: "송파구", lat: 37.5048, lng: 127.1127 },
            { name: "수성구", lat: 35.8588, lng: 128.6318 },
            { name: "중구", lat: 37.5641, lng: 126.9979 },
          ].map((loc) => (
            <button
              key={loc.name}
              onClick={() => setSearchResult({ location: loc.name, lat: loc.lat, lng: loc.lng, fullAddress: loc.name })}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                searchResult?.location === loc.name
                  ? "border-mint bg-mint/10 text-mint-dark"
                  : "border-mint/15 bg-white text-brand-sub hover:border-mint/30"
              }`}
            >
              📍 {loc.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* PC LAYOUT */}
      <div className="hidden md:flex min-h-screen">
        <Sidebar />
        <main className="ml-[260px] flex-1">
          <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-bg/90 backdrop-blur-xl border-b border-mint/10">
            <h1 className="text-xl font-black">📍 내 동네 설정</h1>
          </header>
          <div className="p-8">
            <LocationContent />
          </div>
        </main>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden min-h-screen bg-bg">
        <header className="sticky top-0 z-50 bg-white border-b border-mint/10 flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-lg">←</button>
          <h1 className="text-base font-black flex-1">내 동네 설정</h1>
        </header>
        <div className="pb-24 px-3 pt-3">
          <LocationContent />
        </div>
        <MobileTabBar />
      </div>
    </>
  );
}
