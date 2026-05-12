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

  const handleWorkerLogin = async () => {
    if (!username) return alert('Vui lòng nhập Tên công nhân!');
    if (!password) return alert('Vui lòng nhập Mã nhân viên (Mật khẩu)!');
    
    setIsChecking(true);

    // kiểm tra thông tin trên supabase 
    const { data, error } = await supabase
      .from('employee_accounts')
      .select('*')
      .eq('name', username)
      .eq('code', password);

    if (error || !data || data.length === 0) {
      setIsChecking(false);
      return alert('Tài khoản hoặc Mã nhân viên (Mật khẩu) không đúng! (Hoặc tài khoản chưa được Quản lý tạo)');
    }

    proceedWorkerLogin(username);
  };

  const proceedWorkerLogin = (validUsername) => {
    // Kiểm tra trùng lặp đang hoạt động bằng Supabase Presence
    const channel = supabase.channel('tracking_room');
    let isDuplicate = false;
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const keys = Object.keys(state);
      if (keys.includes(validUsername)) {
        isDuplicate = true;
      }
      
      supabase.removeChannel(channel);
      setIsChecking(false);

      if (isDuplicate) {
        alert(`Lỗi: Công nhân "${validUsername}" đang hoạt động trên một thiết bị khác. Không thể đăng nhập trùng lặp!`);
      } else {
        login({ id: validUsername, name: validUsername, role: 'worker' });
        navigate('/worker');
      }
    });

    const timeoutId = setTimeout(() => {
      if (isChecking) {
        supabase.removeChannel(channel);
        setIsChecking(false);
        login({ id: validUsername, name: validUsername, role: 'worker' });
        navigate('/worker');
      }
    }, 3000);

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        clearTimeout(timeoutId);
      }
    });
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    const adminPwd = localStorage.getItem('app_admin_pwd') || '123';
    if (username !== 'admin' || password !== adminPwd) {
      return alert('Tài khoản hoặc mật khẩu Quản lý không đúng!');
    }
    login({ id: 'admin', name: 'Quản lý', role: 'admin' });
    navigate('/admin');
  };

  return (
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'var(--primary)', padding: '16px', borderRadius: '50%', display: 'inline-flex', boxShadow: '0 0 20px rgba(218, 37, 29, 0.3)' }}>
            <MapPin size={32} color="white" />
          </div>
        </div>
        
        <h1 style={{ marginBottom: '8px', fontSize: '1.75rem', color: 'var(--primary)' }}>WorkerTracker</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
          Đăng nhập để tiếp tục
        </p>
        
        <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={(e) => e.preventDefault()}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Tài khoản (Quản lý: admin / Tên công nhân)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isChecking}
          />
          <input 
            type="password" 
            className="input-field" 
            placeholder="Mật khẩu (Hoặc Mã nhân viên)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isChecking}
          />
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1, opacity: isChecking ? 0.7 : 1 }} 
              onClick={handleWorkerLogin}
              disabled={isChecking}
            >
              <User size={18} />
              {isChecking ? 'Đang vào...' : 'Công nhân'}
            </button>
            <button 
              className="btn btn-accent" 
              style={{ flex: 1, opacity: isChecking ? 0.7 : 1 }} 
              onClick={handleAdminLogin}
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
