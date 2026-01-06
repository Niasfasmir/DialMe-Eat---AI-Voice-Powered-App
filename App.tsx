
import React, { useState, useEffect } from 'react';
import { UserRole, GlobalState, EntityStatus, OrderStatus, Customer, LatLng } from './types';
import AdminDashboard from './views/AdminDashboard';
import RestaurantDashboard from './views/RestaurantDashboard';
import CustomerDashboard from './views/CustomerDashboard';
import RiderDashboard from './views/RiderDashboard';

const STORAGE_KEY = 'dialme-eat-persistent-state';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ 
    name: '', mobile: '', whatsapp: '', address: '', username: '', password: '' 
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const initialState: GlobalState = {
    restaurants: [
      {
        id: 'r1',
        name: 'The Burger Joint',
        ownerId: 'owner1',
        status: EntityStatus.APPROVED,
        items: [{ id: 'i1', name: 'Classic Burger', price: 1200, description: 'Juicy beef patty', category: 'Mains' }],
        username: 'burger',
        password: '123',
        profileImageUrl: 'https://i.pravatar.cc/150?u=r1',
        location: { lat: 6.9271, lng: 79.8612 },
        mobile: '0771234567',
        address: '123 Galle Road, Colombo',
        commissionPercentage: 10
      }
    ],
    customers: [],
    riders: [
      { id: 'rider1', name: 'Flash Rider', status: EntityStatus.APPROVED, username: 'rider', password: '123', profileImageUrl: 'https://i.pravatar.cc/150?u=rider1' }
    ],
    orders: [],
    currentUserRole: UserRole.CUSTOMER,
    adminPassword: '1989',
    isAdminLoggedIn: false,
  };

  const [state, setState] = useState<GlobalState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...parsed, 
          loggedInRestaurantId: undefined, 
          loggedInRiderId: undefined,
          loggedInCustomerId: undefined,
          isAdminLoggedIn: false, // Reset admin login on refresh for security
          adminPassword: parsed.adminPassword || '1989'
        };
      } catch (e) {
        return initialState;
      }
    }
    return initialState;
  });

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state to localStorage (likely quota exceeded due to images):", e);
    }
  }, [state]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const updateState = (updater: (prev: GlobalState) => GlobalState) => {
    setState(updater);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.currentUserRole === UserRole.ADMIN) {
      if (loginForm.username === 'admin' && loginForm.password === state.adminPassword) {
        updateState(s => ({ ...s, isAdminLoggedIn: true }));
        setError('');
      } else {
        setError('Invalid admin credentials');
      }
    } else if (state.currentUserRole === UserRole.RESTAURANT) {
      const res = state.restaurants.find(r => r.username === loginForm.username && r.password === loginForm.password);
      if (res) { updateState(s => ({ ...s, loggedInRestaurantId: res.id })); setError(''); }
      else setError('Invalid credentials');
    } else if (state.currentUserRole === UserRole.RIDER) {
      const rider = state.riders.find(r => r.username === loginForm.username && r.password === loginForm.password);
      if (rider) { updateState(s => ({ ...s, loggedInRiderId: rider.id })); setError(''); }
      else setError('Invalid credentials');
    } else if (state.currentUserRole === UserRole.CUSTOMER) {
      const cust = state.customers.find(c => c.username === loginForm.username && c.password === loginForm.password);
      if (cust) { updateState(s => ({ ...s, loggedInCustomerId: cust.id })); setError(''); }
      else setError('Invalid credentials');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.customers.find(c => c.username === regForm.username)) {
      setError('Username already taken');
      return;
    }

    let location: LatLng | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err) {
      console.warn("Geolocation failed, using default.");
      location = { lat: 6.9271, lng: 79.8612 };
    }

    const newCustomer: Customer = {
      id: 'cust-' + Math.random().toString(36).substr(2, 9),
      ...regForm,
      profileImageUrl: `https://i.pravatar.cc/150?u=${regForm.username}`,
      location
    };
    updateState(s => ({ 
      ...s, 
      customers: [...s.customers, newCustomer],
      loggedInCustomerId: newCustomer.id 
    }));
    setError('');
  };

  const handleLogout = () => {
    updateState(s => ({ 
      ...s, 
      loggedInRestaurantId: undefined, 
      loggedInRiderId: undefined,
      loggedInCustomerId: undefined,
      isAdminLoggedIn: false
    }));
    setLoginForm({ username: '', password: '' });
  };

  const renderAuthForm = () => {
    const isCustomer = state.currentUserRole === UserRole.CUSTOMER;
    const isAdmin = state.currentUserRole === UserRole.ADMIN;

    return (
      <div className="max-w-lg mx-auto mt-12 mb-20 animate-fade-in">
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-black p-10 text-center">
            <h2 className="text-3xl font-black text-white tracking-tighter">
              {isAdmin ? 'Admin Access' : isCustomer ? 'Hungry?' : 'Portal Access'}
            </h2>
            <p className="text-gray-400 text-sm mt-2 font-medium">
              {isAdmin ? 'System-wide management portal.' : isCustomer ? 'Sign up to order delicious food via AI voice.' : 'Login to manage your business.'}
            </p>
          </div>
          
          <div className="p-10">
            {isCustomer && (
              <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
                <button onClick={() => { setIsRegistering(false); setError(''); }} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition ${!isRegistering ? 'bg-white shadow-sm text-red-500' : 'text-gray-400'}`}>Login</button>
                <button onClick={() => { setIsRegistering(true); setError(''); }} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition ${isRegistering ? 'bg-white shadow-sm text-red-500' : 'text-gray-400'}`}>Register</button>
              </div>
            )}

            {isRegistering && isCustomer ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex justify-center mb-6">
                   <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-white shadow-xl overflow-hidden">
                      <img src={`https://i.pravatar.cc/150?u=${regForm.username || 'default'}`} className="w-full h-full object-cover" alt="Profile Preview" />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Full Name</label>
                    <input type="text" value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500 transition" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Mobile</label>
                    <input type="tel" value={regForm.mobile} onChange={e => setRegForm({...regForm, mobile: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500 transition" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">WhatsApp</label>
                    <input type="tel" value={regForm.whatsapp} onChange={e => setRegForm({...regForm, whatsapp: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500 transition" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Address</label>
                    <input type="text" value={regForm.address} onChange={e => setRegForm({...regForm, address: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500 transition" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Username</label>
                    <input type="text" value={regForm.username} onChange={e => setRegForm({...regForm, username: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500 transition" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Password</label>
                    <input type="password" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500 transition" required />
                  </div>
                </div>
                {error && <p className="text-red-500 text-xs font-black">{error}</p>}
                <button type="submit" className="w-full bg-red-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-red-100 hover:bg-red-600 transition">Complete Registration</button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Username</label>
                  <input type="text" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-red-500 transition" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Password</label>
                  <input type="password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-red-500 transition" required />
                </div>
                {error && <p className="text-red-500 text-xs font-black">{error}</p>}
                <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-black text-lg hover:bg-gray-900 transition shadow-xl shadow-gray-200">Sign In</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    switch (state.currentUserRole) {
      case UserRole.ADMIN: return state.isAdminLoggedIn ? <AdminDashboard state={state} updateState={updateState} /> : renderAuthForm();
      case UserRole.RESTAURANT:
        return state.loggedInRestaurantId ? <RestaurantDashboard state={state} updateState={updateState} /> : renderAuthForm();
      case UserRole.RIDER:
        return state.loggedInRiderId ? <RiderDashboard state={state} updateState={updateState} /> : renderAuthForm();
      case UserRole.CUSTOMER:
      default:
        return state.loggedInCustomerId ? <CustomerDashboard state={state} updateState={updateState} /> : renderAuthForm();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => updateState(s => ({ ...s, currentUserRole: UserRole.CUSTOMER }))}>
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-red-200">DME</div>
            <h1 className="text-xl font-black tracking-tighter">DialMe <span className="text-red-500">Eat</span></h1>
          </div>
          <div className="flex items-center gap-4">
            {!hasKey && <button onClick={handleSelectKey} className="bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-amber-600 transition uppercase tracking-widest">Setup Key</button>}
            <select className="bg-gray-100 rounded-xl px-4 py-2 text-xs font-black appearance-none outline-none focus:ring-2 focus:ring-red-500" value={state.currentUserRole} onChange={(e) => { setError(''); updateState(s => ({ ...s, currentUserRole: e.target.value as UserRole })); }}>
              <option value={UserRole.CUSTOMER}>Customer</option>
              <option value={UserRole.RESTAURANT}>Merchant</option>
              <option value={UserRole.RIDER}>Rider</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
            {(state.loggedInRestaurantId || state.loggedInRiderId || state.loggedInCustomerId || state.isAdminLoggedIn) && (
              <button onClick={handleLogout} className="text-xs font-black text-gray-400 hover:text-red-500 transition uppercase tracking-widest">Logout</button>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">{renderDashboard()}</main>
      <footer className="bg-white border-t border-gray-100 p-4 text-center">
        <div className="max-w-7xl mx-auto text-[10px] text-gray-300 font-black uppercase tracking-[0.2em]">DialMe Eat &copy; 2025 • Voice-First Food Network</div>
      </footer>
    </div>
  );
};

export default App;
