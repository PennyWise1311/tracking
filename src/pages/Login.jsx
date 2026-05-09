import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MapPin, User, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = (e, role) => {
    e.preventDefault();

    if (role === 'admin') {
      if (username !== 'admin' || password !== '123') {
        return alert('Tài khoản hoặc mật khẩu Quản lý không đúng! (TK: admin, MK: 123)');
      }
      login({ id: 'admin', name: 'Quản lý', role: 'admin' });
      navigate('/admin');
    } else {
      if (!username) return alert('Vui lòng nhập tên công nhân!');
      if (password !== '1') return alert('Mật khẩu công nhân không đúng! (Mặc định MK là: 1)');

      // Kiểm tra trùng lặp công nhân đang hoạt động
      const workersStr = localStorage.getItem('tracking_workers');
      if (workersStr) {
        const workers = JSON.parse(workersStr);
        const isDuplicate = workers.find(w => w.name.toLowerCase() === username.toLowerCase() && w.active === true);
        if (isDuplicate) {
          return alert(`Lỗi: Công nhân mang tên "${username}" đang được đăng nhập và theo dõi trên một thiết bị khác. Không thể đăng nhập trùng lặp!`);
        }
      }

      // Đăng nhập thành công
      login({ id: username, name: username, role: 'worker' });
      navigate('/worker');
    }
  };

  return (
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'var(--primary)', padding: '16px', borderRadius: '50%', display: 'inline-flex', boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' }}>
            <MapPin size={32} color="white" />
          </div>
        </div>

        <h1 style={{ marginBottom: '8px', fontSize: '1.75rem' }}>WorkerTracker</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Đăng nhập để tiếp tục</p>

        <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Tài khoản (Quản lý: admin / Công nhân: Tên bất kỳ)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="input-field"
            placeholder="Mật khẩu: "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={(e) => handleLogin(e, 'worker')}
            >
              <User size={18} />
              Công nhân
            </button>
            <button
              className="btn btn-accent"
              style={{ flex: 1 }}
              onClick={(e) => handleLogin(e, 'admin')}
            >
              <ShieldCheck size={18} />
              Quản lý
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
