import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MapContainer, TileLayer, Marker, Circle, useMap, Polygon, ImageOverlay } from 'react-leaflet';
import L from 'leaflet';
import { LogOut, Navigation, Bluetooth, ShieldAlert, MonitorPlay } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Custom icon cho Marker
const getWorkerIcon = (name) => new L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; left: -10px; top: -10px;">
      <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'>
        <circle cx='10' cy='10' r='8' fill='#da251d' stroke='#ffffff' stroke-width='2'/>
      </svg>
      <div style="
        position: absolute;
        top: 22px;
        background: rgba(255, 255, 255, 0.9);
        color: #1e293b;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        white-space: nowrap;
      ">
        ${name} (Bạn)
      </div>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0]
});

// Component con để pan map tới vị trí người dùng
function MapUpdater({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lng]);
    }
  }, [location, map]);
  return null;
}

const defaultCenter = [10.905, 106.528]; // Chuyển tâm về khu vực Hóc Môn
const projectPoints = [
  [10.920587, 106.496006],
  [10.916857, 106.561073],
  [10.890058, 106.545214],
  [10.897624, 106.532181],
  [10.902581, 106.531693]
];
const projectBounds = [
  [10.890058, 106.496006],
  [10.920587, 106.561073]
];

export default function WorkerDashboard() {
  const { user, location, setLocation, logout, trackingActive, setTrackingActive } = useStore();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  
  // Ref quản lý
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== 'worker') {
      navigate('/');
      return;
    }

    // Kết nối Supabase Realtime
    const channel = supabase.channel('tracking_room', {
      config: {
        presence: { key: user.id },
      },
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Đã kết nối vào kênh Supabase');
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  // Hàm cập nhật trạng thái lên Supabase
  const syncToAdmin = async (newLoc, isActive) => {
    if (channelRef.current && channelRef.current.state === 'joined') {
      await channelRef.current.track({
        id: user.id,
        name: user.name,
        location: newLoc,
        active: isActive,
        timestamp: newLoc.timestamp
      });
    }
  };

  // Giữ màn hình luôn sáng, độ sáng wakelock để không bị out tab 
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Màn hình đã được giữ sáng liên tục');
      }
    } catch (err) {
      console.log(`Wake Lock error: ${err.message}`);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
        console.log('Đã thả màn hình');
      });
    }
  };

  const startTracking = async () => {
    await requestWakeLock();

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date().getTime()
          };
          setLocation(newLoc);
          setTrackingActive(true);
          setErrorMsg('');
          
          syncToAdmin(newLoc, true);
        },
        (error) => {
          console.error("Lỗi GPS:", error);
          if (error.code === 1) { // PERMISSION_DENIED
            setErrorMsg('Bạn đã từ chối quyền truy cập Vị trí. Vui lòng cấp quyền trong cài đặt trình duyệt.');
            setTrackingActive(false);
            releaseWakeLock();
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
          } else if (error.code === 2) { // POSITION_UNAVAILABLE
            setErrorMsg('Không thể xác định vị trí hiện tại. Đang thử lại...');
          } else if (error.code === 3) { // TIMEOUT
            setErrorMsg('Định vị quá hạn. Đang tiếp tục quét GPS...');
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
      );
    } else {
      setErrorMsg('Trình duyệt không hỗ trợ Geolocation.');
    }

    try {
      if (navigator.bluetooth) {
        setBluetoothEnabled(true);
      }
    } catch (e) {
      console.log('Lỗi Bluetooth:', e);
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    setTrackingActive(false);
    setBluetoothEnabled(false);
    releaseWakeLock();
    
    // Gỡ tracking khỏi presence
    if (channelRef.current) {
      channelRef.current.untrack();
    }
  };

  const handleLogout = () => {
    stopTracking();
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      {/* Header */}
      <header className="glass-panel" style={{ 
        position: 'absolute', top: '20px', left: '20px', right: '20px', 
        zIndex: 1000, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>{user.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: trackingActive ? 'var(--accent)' : 'var(--text-muted)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: trackingActive ? 'var(--accent)' : 'var(--text-muted)', boxShadow: trackingActive ? '0 0 10px var(--accent)' : 'none' }}></div>
              {trackingActive ? 'Đang gửi vị trí lên máy chủ' : 'Đang tạm dừng'}
            </div>
          </div>
        </div>
        
        <button onClick={handleLogout} className="btn" style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px' }}>
          <LogOut size={18} />
          <span style={{ display: 'none' }} className="hide-mobile">Đăng xuất</span>
        </button>
      </header>

      {/* Control Panel overlay */}
      {!trackingActive && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255, 255, 255, 0.85)', zIndex: 1001,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '30px', maxWidth: '400px', textAlign: 'center' }}>
            <ShieldAlert size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
            <h2 style={{ marginBottom: '12px' }}>Yêu cầu bật định vị</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Để tiếp tục công việc, bạn cần bật GPS và Bluetooth. Hệ thống sẽ giữ sáng màn hình để đảm bảo định vị được gửi liên tục cho quản lý ngay cả khi bạn bỏ điện thoại vào túi.
            </p>
            {errorMsg && <p style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '0.9rem' }}>{errorMsg}</p>}
            
            <button className="btn btn-primary" onClick={startTracking} style={{ width: '100%', padding: '16px' }}>
              <Navigation size={20} />
              Bật GPS & Bắt đầu
            </button>
          </div>
        </div>
      )}

      {/* Status Badges */}
      {trackingActive && (
        <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '30px' }}>
            <Navigation size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>GPS Bật</span>
          </div>
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '30px' }}>
            <Bluetooth size={16} color={bluetoothEnabled ? "var(--primary)" : "var(--text-muted)"} />
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{bluetoothEnabled ? 'BT Bật' : 'BT Tắt'}</span>
          </div>
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '30px' }}>
            <MonitorPlay size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Wake Lock Bật</span>
          </div>
        </div>
      )}

      {/* Leaflet Map check leafmap liên tục  */}
      <div style={{ flex: 1, height: '100vh', width: '100vw' }}>
        <MapContainer 
          center={location ? [location.lat, location.lng] : defaultCenter} 
          zoom={15} 
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: 'var(--bg-dark)' }}
        >
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution="&copy; Google Maps"
            className="dark-map-tiles"
          />

          {/* Vẽ ranh giới dự án cho công nhân dễ hình dung */}
          <Polygon
            positions={projectPoints}
            pathOptions={{
              color: 'var(--primary)',
              fillColor: 'transparent',
              weight: 2,
              dashArray: '5, 5'
            }}
          />
          
          <ImageOverlay
            url="/src/assets/vinhomes.jpg"
            bounds={projectBounds}
            opacity={0.5}
            interactive={true}
          />
          
          <MapUpdater location={location} />

          {location && (
            <>
              <Marker position={[location.lat, location.lng]} icon={getWorkerIcon(user.name)} />
              <Circle 
                center={[location.lat, location.lng]}
                radius={10000} // 10km
                pathOptions={{
                  color: "#da251d",
                  fillColor: "#da251d",
                  fillOpacity: 0.05,
                  weight: 2,
                  opacity: 0.3
                }}
              />
              <Circle 
                center={[location.lat, location.lng]}
                radius={100} // radar nhỏ
                pathOptions={{
                  color: "#da251d",
                  fillColor: "#da251d",
                  fillOpacity: 0.3,
                  weight: 1,
                  opacity: 0.8
                }}
              />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
