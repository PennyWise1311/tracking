import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MapPin, User, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const login = useStore((state) => state.login);
  const navigate = useNavigate();

  const handleWorkerRegister = async () => {
    if (!username) return alert('Vui lòng nhập tên tài khoản muốn tạo!');
    if (!password) return alert('Vui lòng nhập Mã nhân viên!');

    setIsChecking(true);
    
    // 1. Kiểm tra xem mã nhân viên có tồn tại không
    const { data: codeData, error: codeError } = await supabase
      .from('employee_accounts')
      .select('*')
      .eq('code', password);

    if (codeError || !codeData || codeData.length === 0) {
      setIsChecking(false);
      return alert('Lỗi: Mã nhân viên không tồn tại trong hệ thống! Vui lòng liên hệ Quản trị viên.');
    }

    const account = codeData[0];

    // 2. Kiểm tra xem mã này đã được ai đăng ký chưa
    if (account.is_registered) {
      setIsChecking(false);
      return alert(`Lỗi: Mã nhân viên này đã được đăng ký cho tài khoản "${account.name}"!`);
    }

    // 3. Kiểm tra xem tên tài khoản này đã có ai lấy chưa (tên phải duy nhất)
    const { data: nameData } = await supabase
      .from('employee_accounts')
      .select('*')
      .eq('name', username);
      
    if (nameData && nameData.length > 0) {
      setIsChecking(false);
      return alert('Lỗi: Tên tài khoản này đã có người sử dụng, vui lòng chọn tên khác!');
    }

    // 4. Tiến hành đăng ký (Cập nhật tên và trạng thái)
    const { error: updateError } = await supabase
      .from('employee_accounts')
      .update({ name: username, is_registered: true })
      .eq('code', password);

    setIsChecking(false);

    if (updateError) {
      return alert('Có lỗi xảy ra khi đăng ký, vui lòng thử lại!');
    }

    alert('Đăng ký thành công! Bạn đang được tự động đăng nhập...');
    proceedWorkerLogin(username);
  };

  const handleWorkerLogin = async () => {
    if (!username) return alert('Vui lòng nhập tên công nhân!');
    if (!password) return alert('Vui lòng nhập Mã nhân viên (Mật khẩu)!');
    
    setIsChecking(true);

    // Kiểm tra thông tin trong Database
    const { data, error } = await supabase
      .from('employee_accounts')
      .select('*')
      .eq('name', username)
      .eq('code', password);

    if (error || !data || data.length === 0) {
      setIsChecking(false);
      return alert('Tài khoản hoặc Mã nhân viên (Mật khẩu) không đúng! (Hoặc tài khoản chưa được đăng ký)');
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
          {isRegisterMode ? 'Đăng ký tài khoản công nhân mới' : 'Đăng nhập để tiếp tục'}
        </p>
        
        <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={(e) => e.preventDefault()}>
          <input 
            type="text" 
            className="input-field" 
            placeholder={isRegisterMode ? "Nhập tên tài khoản muốn tạo" : "Tài khoản (Quản lý: admin / Công nhân)"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isChecking}
          />
          <input 
            type="password" 
            className="input-field" 
            placeholder={isRegisterMode ? "Nhập Mã nhân viên (Cấp bởi quản lý)" : "Mật khẩu (Hoặc Mã nhân viên)"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isChecking}
          />
          
          {isRegisterMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleWorkerRegister}
                disabled={isChecking}
              >
                <UserPlus size={18} />
                {isChecking ? 'Đang kiểm tra...' : 'Xác nhận Đăng ký'}
              </button>
              <button 
                className="btn" 
                style={{ background: 'transparent', color: 'var(--text-muted)' }}
                onClick={() => setIsRegisterMode(false)}
                disabled={isChecking}
              >
                Quay lại Đăng nhập
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
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
              <button 
                className="btn" 
                style={{ background: 'rgba(218, 37, 29, 0.1)', color: 'var(--primary)', marginTop: '8px' }}
                onClick={() => { setIsRegisterMode(true); setUsername(''); setPassword(''); }}
                disabled={isChecking}
              >
                <UserPlus size={18} />
                Đăng ký tài khoản công nhân
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
