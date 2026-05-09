import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { LogOut, Users, Map as MapIcon, Crosshair } from 'lucide-react';

const defaultCenter = [21.0285, 105.8542]; // Hà Nội

// Helper components & icons
function MapUpdater({ selectedWorker, adminLocation, followAdmin }) {
  const map = useMap();
  useEffect(() => {
    if (selectedWorker && selectedWorker.location) {
      map.panTo([selectedWorker.location.lat, selectedWorker.location.lng]);
    } else if (followAdmin && adminLocation) {
      map.panTo([adminLocation.lat, adminLocation.lng]);
    }
  }, [selectedWorker, adminLocation, followAdmin, map]);
  return null;
}

const getWorkerIcon = (active) => new L.Icon({
  iconUrl: `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='${active ? '%2310b981' : '%23ef4444'}' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'%3E%3C/path%3E%3Ccircle cx='12' cy='10' r='3' fill='%23ffffff'%3E%3C/circle%3E%3C/svg%3E`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const adminIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23f59e0b' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'%3E%3C/polygon%3E%3C/svg%3E`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

export default function AdminDashboard() {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const [selectedWorker, setSelectedWorker] = useState(null);
  
  // State cho vị trí Admin
  const [adminLocation, setAdminLocation] = useState(null);
  const [followAdmin, setFollowAdmin] = useState(true);
  const watchIdRef = useRef(null);

  // Dữ liệu thật của công nhân từ các tab khác
  const [realWorkers, setRealWorkers] = useState([]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }

    // Bật GPS để lấy vị trí của Admin
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setAdminLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Lỗi GPS Admin:", error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user, navigate]);

  // Lấy dữ liệu thật từ LocalStorage liên tục (cập nhật chéo tab)
  useEffect(() => {
    const fetchWorkers = () => {
      const workersStr = localStorage.getItem('tracking_workers');
      if (workersStr) {
        setRealWorkers(JSON.parse(workersStr));
      }
    };

    fetchWorkers(); // initial fetch
    
    // Lắng nghe sự kiện storage khi tab Worker cập nhật
    window.addEventListener('storage', fetchWorkers);
    
    // Fallback polling mỗi 1 giây để đảm bảo lúc nào cũng có dữ liệu
    const interval = setInterval(fetchWorkers, 1000);

    return () => {
      window.removeEventListener('storage', fetchWorkers);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCenterAdmin = () => {
    setSelectedWorker(null);
    setFollowAdmin(true);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  if (!user) return null;

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: '320px', background: 'var(--bg-dark)', borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', zIndex: 1000 }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapIcon size={20} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Admin Panel</h1>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.name}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)' }}>
              <LogOut size={20} />
            </button>
          </div>
          
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{realWorkers.length}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Công nhân (Realtime)</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} color="var(--primary)" />
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px' }}
            onClick={handleCenterAdmin}
          >
            <Crosshair size={18} />
            Vị trí của tôi
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px', padding: '0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Danh sách công nhân
          </h3>
          {realWorkers.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Chưa có công nhân nào trực tuyến. Hãy mở tab mới và đăng nhập quyền công nhân để xem dữ liệu thật.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {realWorkers.map(w => {
              const distance = adminLocation ? calculateDistance(adminLocation.lat, adminLocation.lng, w.location.lat, w.location.lng) : null;
              
              return (
                <div 
                  key={w.id}
                  onClick={() => {
                    setSelectedWorker(w);
                    setFollowAdmin(false);
                  }}
                  className="glass-panel" 
                  style={{ 
                    padding: '16px', 
                    cursor: 'pointer',
                    border: selectedWorker?.id === w.id ? '1px solid var(--primary)' : '1px solid transparent',
                    background: selectedWorker?.id === w.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: '500' }}>{w.name}</div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: w.active ? 'var(--accent)' : 'var(--danger)', boxShadow: w.active ? '0 0 8px var(--accent)' : 'none' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Cập nhật: {new Date(w.location.timestamp).toLocaleTimeString()}
                    </div>
                    {distance && (
                      <div style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: '#f59e0b' }}>
                        Cách {distance}km
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaflet Map Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer 
          center={adminLocation ? [adminLocation.lat, adminLocation.lng] : defaultCenter} 
          zoom={13} 
          zoomControl={true}
          style={{ height: '100%', width: '100%', background: 'var(--bg-dark)' }}
        >
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution="&copy; Google Maps"
            className="dark-map-tiles"
          />
          
          <MapUpdater selectedWorker={selectedWorker} adminLocation={adminLocation} followAdmin={followAdmin} />

          {adminLocation && (
            <>
              <Marker position={[adminLocation.lat, adminLocation.lng]} icon={adminIcon}>
                <Popup>
                  <div style={{ color: '#000', padding: '0px', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#f59e0b' }}>Vị trí của bạn (Quản lý)</h3>
                  </div>
                </Popup>
              </Marker>
              
              <Circle 
                center={[adminLocation.lat, adminLocation.lng]}
                radius={10000} // 10km
                pathOptions={{
                  color: "#f59e0b",
                  fillColor: "#f59e0b",
                  fillOpacity: 0.05,
                  weight: 2,
                  dashArray: '5, 10'
                }}
              />
            </>
          )}

          {realWorkers.map((w) => (
            <Marker
              key={w.id}
              position={[w.location.lat, w.location.lng]}
              icon={getWorkerIcon(w.active)}
              eventHandlers={{
                click: () => {
                  setSelectedWorker(w);
                  setFollowAdmin(false);
                },
              }}
            >
              <Popup>
                <div style={{ color: '#000', padding: '0px' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>{w.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
                    Trạng thái: <strong style={{ color: w.active ? '#10b981' : '#ef4444' }}>{w.active ? 'Đang hoạt động' : 'Dừng tín hiệu / Mất kết nối'}</strong>
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                    Cập nhật cuối: {new Date(w.location.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
