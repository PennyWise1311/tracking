import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polygon, ImageOverlay } from 'react-leaflet';
import L from 'leaflet';
import { LogOut, Users, Map as MapIcon, Crosshair, Settings, Trash2, RefreshCw, Database, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../supabaseClient';

const defaultCenter = [10.905, 106.528]; // Chuyển tâm về khu vực Hóc Môn
const projectPoints = [
  [10.92042224328965, 106.49653282876102],
  [10.911666339736058, 106.51412862588342],
  [10.9028030246986, 106.53165127305914],
  [10.901383962134787, 106.53270128440425],
  [10.899988676781689, 106.53306797443429],
  [10.897511287173629, 106.53231167706446],
  [10.890052305804232, 106.54518185666865],
  [10.91473059743899, 106.5597200764106],
  [10.916748979838559, 106.56100428469614],
  [10.916895539660942, 106.56075168919944],
  [10.916343121491508, 106.55064786929626],
  [10.915896080534907, 106.54261997340103],
  [10.915808648437817, 106.5368171383621],
  [10.91775437005657, 106.52051825289334],
  [10.918979107093364, 106.51096742903815],
  [10.919847793125115, 106.50344447579721],
  [10.920410720868546, 106.49652762791607]
];

// Tính toán vùng bao quanh (Bounding Box) cho hình ảnh
const projectBounds = [
  [10.890052305804232, 106.49652762791607],
  [10.92042224328965, 106.56100428469614]
];

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

const getWorkerIcon = (name, active) => new L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; left: -10px; top: -10px;">
      <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'>
        <circle cx='10' cy='10' r='8' fill='${active ? '#10b981' : '#ef4444'}' stroke='#ffffff' stroke-width='2'/>
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
        ${name}
      </div>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  popupAnchor: [0, -10]
});

const adminIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23da251d' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'%3E%3C/polygon%3E%3C/svg%3E`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

export default function AdminDashboard() {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const [selectedWorker, setSelectedWorker] = useState(null);

  const [adminLocation, setAdminLocation] = useState(null);
  const [followAdmin, setFollowAdmin] = useState(true);
  const watchIdRef = useRef(null);

  const [realWorkersMap, setRealWorkersMap] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [dbCodes, setDbCodes] = useState([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [newAdminPwd, setNewAdminPwd] = useState(localStorage.getItem('app_admin_pwd') || '123');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showProject, setShowProject] = useState(true);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }

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
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
      );
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user, navigate]);

  // Load employee codes from Supabase
  const loadCodes = async () => {
    const { data, error } = await supabase.from('employee_accounts').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setDbCodes(data);
    }
  };

  const handleAddCode = async () => {
    if (!newCode.trim() || !newName.trim()) {
      return alert('Vui lòng nhập đầy đủ Tên công nhân và Mã nhân viên!');
    }
    const { error } = await supabase.from('employee_accounts').insert([{
      name: newName.trim(),
      code: newCode.trim(),
      is_registered: true // Đã được quản lý tạo nên đánh dấu đăng ký luôn
    }]);
    if (error) {
      alert('Lỗi: Tên hoặc Mã nhân viên này đã tồn tại!');
      console.error(error);
    } else {
      setNewCode('');
      setNewName('');
      loadCodes();
    }
  };

  const handleDeleteCode = async (id) => {
    if (window.confirm('Xoá mã nhân viên này?')) {
      await supabase.from('employee_accounts').delete().eq('id', id);
      loadCodes();
    }
  };

  const connectToSupabase = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel('tracking_room');
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();

        setRealWorkersMap(prev => {
          const next = { ...prev };
          const activeIds = new Set();

          for (const key in state) {
            if (state[key].length > 0) {
              const data = state[key][0];
              next[data.id] = { ...data, active: data.active !== false };
              activeIds.add(data.id);
            }
          }

          for (const id in next) {
            if (!activeIds.has(id)) {
              next[id].active = false;
            }
          }

          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        setRealWorkersMap(prev => {
          if (!prev[key]) return prev;
          return {
            ...prev,
            [key]: { ...prev[key], active: false }
          };
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Admin đã kết nối vào kênh lắng nghe');
          setIsRefreshing(false);
        }
      });
  };

  // Lắng nghe Supabase Presence lần đầu
  useEffect(() => {
    connectToSupabase();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    connectToSupabase();
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCenterAdmin = () => {
    setSelectedWorker(null);
    setFollowAdmin(true);
  };

  const handleSavePasswords = () => {
    localStorage.setItem('app_admin_pwd', newAdminPwd);
    alert('Đã thay đổi mật khẩu Quản lý thành công!');
    setShowSettings(false);
  };

  const handleClearData = () => {
    if (window.confirm('Bạn có chắc muốn xoá toàn bộ dữ liệu tạm thời trong bộ nhớ web?')) {
      localStorage.clear();
      setRealWorkersMap({});
      alert('Đã xoá sạch dữ liệu!');
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  if (!user) return null;

  const realWorkers = Object.values(realWorkersMap);
  const activeCount = realWorkers.filter(w => w.active).length;

  return (
    <div className="app-container admin-layout" style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden' }}>

      {/* Database Modal */}
      {showDbModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '20px', width: '95%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--primary)', fontSize: '1.25rem' }}>Cơ sở dữ liệu (Database)</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Thêm tài khoản công nhân mới.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <input type="text" className="input-field" placeholder="Tên công nhân (VD: kieu)" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" className="input-field" placeholder="Mã nhân viên / Mật khẩu (VD: NV001)" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                <button className="btn btn-primary" onClick={handleAddCode}><Plus size={18} /></button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', background: 'var(--bg-dark)', borderRadius: '8px', padding: '10px' }}>
              {dbCodes.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Chưa có tài khoản nào</div>}
              {dbCodes.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>{c.name}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Mã NV (Mật khẩu): <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{c.code}</span>
                    </div>
                  </div>
                  <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDeleteCode(c.id)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            <button className="btn" style={{ width: '100%', background: 'var(--text-muted)' }} onClick={() => setShowDbModal(false)}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Cài đặt Overlay */}
      {showSettings && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '20px', width: '95%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Cài đặt hệ thống</h2>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Mật khẩu Quản lý mới:</label>
              <input type="text" className="input-field" value={newAdminPwd} onChange={(e) => setNewAdminPwd(e.target.value)} />
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '10px' }} onClick={handleSavePasswords}>
              Lưu thay đổi
            </button>
            <button className="btn" style={{ width: '100%', background: 'var(--bg-card)' }} onClick={() => setShowSettings(false)}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} style={{ width: '320px', background: 'var(--bg-dark)', borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', zIndex: 1000 }}>

        {/* Mobile Drag Handle / Toggle */}
        <div className="mobile-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ padding: '8px', textAlign: 'center', background: 'var(--bg-card)', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--primary)', fontWeight: '500', fontSize: '0.9rem' }}>
            {isSidebarCollapsed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            {isSidebarCollapsed ? 'Hiện danh sách nhân viên' : 'Thu gọn danh sách'}
          </div>
        </div>

        <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="sidebar-header" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapIcon size={16} color="white" />
                </div>
                <div>
                  <h1 style={{ fontSize: '1.1rem', margin: 0 }}>Admin Trang Chủ</h1>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.name}</span>
                </div>
              </div>

              <div className="sidebar-actions" style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => { setShowDbModal(true); loadCodes(); }} className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)' }} title="Database Mã NV">
                  <Database size={20} />
                </button>
                <button onClick={() => setShowSettings(true)} className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)' }} title="Cài đặt">
                  <Settings size={20} />
                </button>
                <button onClick={handleLogout} className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)' }} title="Đăng xuất">
                  <LogOut size={20} />
                </button>
              </div>
            </div>

            <div className="glass-panel stats-card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{activeCount}/{realWorkers.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đang hoạt động</div>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(218, 37, 29, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={18} color="var(--primary)" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '12px' }} onClick={handleCenterAdmin}>
                <Crosshair size={18} />
                Vị trí của tôi
              </button>
              <button className="btn btn-accent" style={{ padding: '12px' }} onClick={handleRefresh} title="Làm mới kết nối">
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              </button>
              <button className="btn btn-danger" style={{ padding: '12px' }} onClick={handleClearData} title="Xoá dữ liệu tạm">
                <Trash2 size={18} />
              </button>
            </div>

            <div className="glass-panel" style={{ marginTop: '12px', padding: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={showProject} onChange={(e) => setShowProject(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span>Hiện quy mô dự án Vinhomes</span>
              </label>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px', padding: '0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Danh sách công nhân
            </h3>
            {realWorkers.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Trống. Đợi công nhân kết nối...
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {realWorkers.map(w => {
                const distance = (adminLocation && w.location) ? calculateDistance(adminLocation.lat, adminLocation.lng, w.location.lat, w.location.lng) : null;

                return (
                  <div
                    key={w.id}
                    onClick={() => {
                      setSelectedWorker(w);
                      setFollowAdmin(false);
                    }}
                    className="glass-panel worker-item"
                    style={{
                      padding: '14px',
                      cursor: 'pointer',
                      border: selectedWorker?.id === w.id ? '1.5px solid var(--primary)' : '1px solid transparent',
                      background: selectedWorker?.id === w.id ? 'rgba(218, 37, 29, 0.05)' : 'var(--bg-card)',
                      transition: 'all 0.2s',
                      boxShadow: selectedWorker?.id === w.id ? '0 4px 12px rgba(218, 37, 29, 0.1)' : 'var(--glass-shadow)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: '500' }}>{w.name}</div>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: w.active ? 'var(--accent)' : 'var(--danger)', boxShadow: w.active ? '0 0 8px var(--accent)' : 'none' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Cập nhật: {w.location?.timestamp ? new Date(w.location.timestamp).toLocaleTimeString() : 'Chưa rõ'}
                        <br />
                        <span style={{ color: w.active ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                          {w.active ? 'Đã kết nối' : 'Tắt kết nối'}
                        </span>
                      </div>
                      {distance && (
                        <div style={{ fontSize: '0.75rem', background: 'rgba(218, 37, 29, 0.1)', padding: '2px 8px', borderRadius: '12px', color: 'var(--primary)' }}>
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
      </div>

      {/* Leaflet Map Area */}
      <div className="admin-map-area" style={{ flex: 1, position: 'relative' }}>
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

          {showProject && (
            <>
              {/* Vẽ ranh giới dự án */}
              <Polygon
                positions={projectPoints}
                pathOptions={{
                  color: 'var(--primary)',
                  fillColor: 'transparent',
                  weight: 3,
                  dashArray: '10, 10'
                }}
              />
              
              {/* Đè hình ảnh quy mô lên */}
              <ImageOverlay
                url="/src/assets/vinhomes.jpg" // Bạn hãy đổi tên ảnh thành vinhomes.jpg và bỏ vào src/assets
                bounds={projectBounds}
                opacity={0.6}
                interactive={true}
              />
            </>
          )}

          <MapUpdater selectedWorker={selectedWorker} adminLocation={adminLocation} followAdmin={followAdmin} />

          {adminLocation && (
            <>
              <Marker position={[adminLocation.lat, adminLocation.lng]} icon={adminIcon}>
                <Popup>
                  <div style={{ color: '#000', padding: '0px', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--primary)' }}>Vị trí của bạn (Quản lý)</h3>
                  </div>
                </Popup>
              </Marker>

              <Circle
                center={[adminLocation.lat, adminLocation.lng]}
                radius={10000} // 10km
                pathOptions={{
                  color: "var(--primary)",
                  fillColor: "var(--primary)",
                  fillOpacity: 0.05,
                  weight: 2,
                  dashArray: '5, 10'
                }}
              />
            </>
          )}

          {realWorkers.map((w) => {
            if (!w.location) return null;
            return (
              <Marker
                key={w.id}
                position={[w.location.lat, w.location.lng]}
                icon={getWorkerIcon(w.name, w.active)}
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
                      Trạng thái: <strong style={{ color: w.active ? '#10b981' : '#ef4444' }}>{w.active ? 'Đã kết nối' : 'Tắt kết nối'}</strong>
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#666' }}>
                      Cập nhật cuối: {w.location?.timestamp ? new Date(w.location.timestamp).toLocaleTimeString() : ''}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
