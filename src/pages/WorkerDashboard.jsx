import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LogOut, Navigation, Bluetooth, ShieldAlert, MonitorPlay } from 'lucide-react';

// Custom icon cho Marker
const workerIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'%3E%3C/path%3E%3Ccircle cx='12' cy='10' r='3'%3E%3C/circle%3E%3C/svg%3E",
  iconSize: [36, 36],
  iconAnchor: [18, 36]
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

const defaultCenter = [21.0285, 105.8542]; // Hà Nội

export default function WorkerDashboard() {
  const { user, location, setLocation, logout, trackingActive, setTrackingActive } = useStore();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  
  // Ref quản lý
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== 'worker') {
      navigate('/');
    }
  }, [user, navigate]);

  // Hàm cập nhật trạng thái lên LocalStorage để Admin thấy (dữ liệu thật qua các tab)
  const syncToAdmin = (newLoc, isActive) => {
    if (!user) return;
    const workersStr = localStorage.getItem('tracking_workers');
    let workers = workersStr ? JSON.parse(workersStr) : [];
    
    const myData = {
      id: user.id,
      name: user.name,
      location: newLoc,
      active: isActive
    };
    
    const existingIdx = workers.findIndex(w => w.id === user.id);
    if (existingIdx >= 0) {
      workers[existingIdx] = myData;
    } else {
      workers.push(myData);
    }
    
    localStorage.setItem('tracking_workers', JSON.stringify(workers));
    window.dispatchEvent(new Event('storage')); // trigger update
  };

  // Giữ màn hình luôn sáng để GPS không bị hệ điều hành tắt ngầm
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
    // 1. Giữ sáng màn hình
    await requestWakeLock();

    // 2. Bật GPS
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
          
          // GỬI DỮ LIỆU ĐỊNH VỊ THẬT CHO ADMIN
          syncToAdmin(newLoc, true);
        },
        (error) => {
          console.error("Lỗi GPS:", error);
          setErrorMsg('Vui lòng bật định vị (GPS) để có thể theo dõi.');
          setTrackingActive(false);
          releaseWakeLock();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setErrorMsg('Trình duyệt không hỗ trợ Geolocation.');
    }

    // 3. Xin quyền Bluetooth
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
    
    // Báo cho Admin biết đã mất tín hiệu / dừng
    if (location) {
      syncToAdmin(location, false);
    }
  };

  const handleLogout = () => {
    stopTracking();
    
    // Xoá hẳn khỏi danh sách active trên admin
    if (user) {
      const workersStr = localStorage.getItem('tracking_workers');
      if (workersStr) {
        let workers = JSON.parse(workersStr);
        workers = workers.filter(w => w.id !== user.id);
        localStorage.setItem('tracking_workers', JSON.stringify(workers));
        window.dispatchEvent(new Event('storage'));
      }
    }

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
              {trackingActive ? 'Đang theo dõi vị trí' : 'Đang tạm dừng'}
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
          background: 'rgba(15, 23, 42, 0.8)', zIndex: 1001,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '30px', maxWidth: '400px', textAlign: 'center' }}>
            <ShieldAlert size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
            <h2 style={{ marginBottom: '12px' }}>Yêu cầu bật định vị</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Để tiếp tục công việc, bạn cần bật GPS và Bluetooth. Hệ thống sẽ giữ sáng màn hình để đảm bảo định vị được gửi liên tục cho quản lý ngay cả khi bạn bỏ điện thoại vào túi.
            </p>
            {errorMsg && <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.9rem' }}>{errorMsg}</p>}
            
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
            <Navigation size={16} color="var(--accent)" />
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>GPS Bật</span>
          </div>
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '30px' }}>
            <Bluetooth size={16} color={bluetoothEnabled ? "var(--primary)" : "var(--text-muted)"} />
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{bluetoothEnabled ? 'BT Bật' : 'BT Tắt'}</span>
          </div>
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '30px' }}>
            <MonitorPlay size={16} color="var(--accent)" />
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Wake Lock Bật</span>
          </div>
        </div>
      )}

      {/* Leaflet Map */}
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
          
          <MapUpdater location={location} />

          {location && (
            <>
              <Marker position={[location.lat, location.lng]} icon={workerIcon} />
              <Circle 
                center={[location.lat, location.lng]}
                radius={10000} // 10km
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.05,
                  weight: 2,
                  opacity: 0.3
                }}
              />
              <Circle 
                center={[location.lat, location.lng]}
                radius={100} // radar nhỏ
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
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
