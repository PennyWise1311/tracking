import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MapPin, User, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const login = useStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e, role) => {
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
      
      setIsChecking(true);

      // Kiểm tra trùng lặp bằng Supabase Presence
      const channel = supabase.channel('tracking_room');
      
      let isDuplicate = false;
      
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const keys = Object.keys(state);
        // Kiểm tra xem ID (chính là username) đã online chưa
        if (keys.includes(username)) {
          isDuplicate = true;
        }
        
        supabase.removeChannel(channel);
        setIsChecking(false);

        if (isDuplicate) {
          alert(`Lỗi: Công nhân mang tên "${username}" đang hoạt động trên một thiết bị khác. Không thể đăng nhập trùng lặp!`);
        } else {
          login({ id: username, name: username, role: 'worker' });
          navigate('/worker');
        }
      });

      // Nếu sau 2s không kết nối được hoặc không có ai, tự động cho vào (phòng hờ)
      const timeoutId = setTimeout(() => {
        if (isChecking) {
          supabase.removeChannel(channel);
          setIsChecking(false);
          login({ id: username, name: username, role: 'worker' });
          navigate('/worker');
        }
      }, 3000);

      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          clearTimeout(timeoutId);
        }
      });
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
            disabled={isChecking}
          />
          <input 
            type="password" 
            className="input-field" 
            placeholder="Mật khẩu (Quản lý: 123 / Công nhân: 1)" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isChecking}
          />
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1, opacity: isChecking ? 0.7 : 1 }} 
              onClick={(e) => handleLogin(e, 'worker')}
              disabled={isChecking}
            >
              <User size={18} />
              {isChecking ? 'Đang kiểm tra...' : 'Công nhân'}
            </button>
            <button 
              className="btn btn-accent" 
              style={{ flex: 1, opacity: isChecking ? 0.7 : 1 }} 
              onClick={(e) => handleLogin(e, 'admin')}
              disabled={isChecking}
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
