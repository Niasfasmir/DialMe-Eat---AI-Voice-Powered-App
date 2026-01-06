
import React, { useState, useMemo } from 'react';
import { GlobalState, EntityStatus, Restaurant, Rider, OrderStatus } from '../types';

interface Props {
  state: GlobalState;
  updateState: (updater: (prev: GlobalState) => GlobalState) => void;
}

interface DailySummary {
  date: string;
  totalFoodSales: number;
  totalCommission: number;
  totalShopPayable: number;
}

const AdminDashboard: React.FC<Props> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'network' | 'financials' | 'settings'>('network');
  
  const [newResName, setNewResName] = useState('');
  const [newResUser, setNewResUser] = useState('');
  const [newResPass, setNewResPass] = useState('');
  
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderUser, setNewRiderUser] = useState('');
  const [newRiderPass, setNewRiderPass] = useState('');
  const [newRiderMobile, setNewRiderMobile] = useState('');

  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);

  const [newAdminPass, setNewAdminPass] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);

  // Calculate platform commission per restaurant
  const merchantCommissions = useMemo(() => {
    const comms: Record<string, number> = {};
    state.restaurants.forEach(r => {
      const restaurantOrders = state.orders.filter(o => o.restaurantId === r.id && o.status === OrderStatus.DELIVERED);
      const totalComm = restaurantOrders.reduce((acc, order) => {
        const foodSubtotal = order.total - order.deliveryFee;
        return acc + (foodSubtotal * ((r.commissionPercentage || 0) / 100));
      }, 0);
      comms[r.id] = totalComm;
    });
    return comms;
  }, [state.orders, state.restaurants]);

  // Date-wise Financial Summary
  const dailyFinancials = useMemo(() => {
    const summaryMap: Record<string, DailySummary> = {};
    
    state.orders
      .filter(o => o.status === OrderStatus.DELIVERED)
      .forEach(order => {
        const dateObj = new Date(order.createdAt);
        const dateStr = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        const restaurant = state.restaurants.find(r => r.id === order.restaurantId);
        const foodSubtotal = order.total - order.deliveryFee;
        const commission = foodSubtotal * ((restaurant?.commissionPercentage || 0) / 100);
        const shopPayable = foodSubtotal - commission;

        if (!summaryMap[dateStr]) {
          summaryMap[dateStr] = {
            date: dateStr,
            totalFoodSales: 0,
            totalCommission: 0,
            totalShopPayable: 0
          };
        }

        summaryMap[dateStr].totalFoodSales += foodSubtotal;
        summaryMap[dateStr].totalCommission += commission;
        summaryMap[dateStr].totalShopPayable += shopPayable;
      });

    return Object.values(summaryMap).sort((a, b) => b.date.localeCompare(a.date));
  }, [state.orders, state.restaurants]);

  const handleCreateRestaurant = (e: React.FormEvent) => {
    e.preventDefault();
    const newRestaurant: Restaurant = {
      id: 'res-' + Math.random().toString(36).substr(2, 9),
      name: newResName,
      ownerId: 'owner-current',
      status: EntityStatus.APPROVED,
      items: [],
      username: newResUser,
      password: newResPass,
      profileImageUrl: `https://i.pravatar.cc/150?u=${newResUser}`,
      location: { lat: 6.9271, lng: 79.8612 },
      commissionPercentage: 10,
      mobile: '',
      address: ''
    };
    updateState(s => ({ ...s, restaurants: [...s.restaurants, newRestaurant] }));
    setNewResName(''); setNewResUser(''); setNewResPass('');
  };

  const handleCreateRider = (e: React.FormEvent) => {
    e.preventDefault();
    const newRider: Rider = {
      id: 'rider-' + Math.random().toString(36).substr(2, 9),
      name: newRiderName,
      status: EntityStatus.APPROVED,
      username: newRiderUser,
      password: newRiderPass,
      mobile: newRiderMobile,
      profileImageUrl: `https://i.pravatar.cc/150?u=${newRiderUser}`
    };
    updateState(s => ({ ...s, riders: [...s.riders, newRider] }));
    setNewRiderName(''); setNewRiderUser(''); setNewRiderPass(''); setNewRiderMobile('');
  };

  const handleAdminPassUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminPass) return;
    updateState(s => ({ ...s, adminPassword: newAdminPass }));
    setPassSuccess(true);
    setNewAdminPass('');
    setTimeout(() => setPassSuccess(false), 3000);
  };

  const deleteRestaurant = (id: string) => {
    if (confirm('Are you sure you want to delete this restaurant?')) {
      updateState(s => ({ ...s, restaurants: s.restaurants.filter(r => r.id !== id) }));
    }
  };

  const deleteRider = (id: string) => {
    if (confirm('Are you sure you want to delete this rider?')) {
      updateState(s => ({ ...s, riders: s.riders.filter(r => r.id !== id) }));
    }
  };

  const saveEditedRestaurant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRestaurant) return;
    updateState(s => ({
      ...s,
      restaurants: s.restaurants.map(r => r.id === editingRestaurant.id ? editingRestaurant : r)
    }));
    setEditingRestaurant(null);
  };

  const saveEditedRider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRider) return;
    updateState(s => ({
      ...s,
      riders: s.riders.map(r => r.id === editingRider.id ? editingRider : r)
    }));
    setEditingRider(null);
  };

  return (
    <div className="space-y-8 animate-fade-in relative pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter">Admin <span className="text-red-500">Console</span></h2>
          <p className="text-gray-500 font-medium">Global Network Health & Financial Control</p>
        </div>
        <div className="flex bg-gray-100 p-1.5 rounded-3xl self-start">
           <button onClick={() => setActiveTab('network')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition ${activeTab === 'network' ? 'bg-white shadow-sm text-red-500' : 'text-gray-400'}`}>Network</button>
           <button onClick={() => setActiveTab('financials')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition ${activeTab === 'financials' ? 'bg-white shadow-sm text-red-500' : 'text-gray-400'}`}>Financials</button>
           <button onClick={() => setActiveTab('settings')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition ${activeTab === 'settings' ? 'bg-white shadow-sm text-red-500' : 'text-gray-400'}`}>Settings</button>
        </div>
      </header>

      {/* Edit Restaurant Modal */}
      {editingRestaurant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl my-8 animate-slide-up">
            <h3 className="text-2xl font-black mb-6">Edit Restaurant</h3>
            <form onSubmit={saveEditedRestaurant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Shop Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRestaurant.name} 
                    onChange={e => setEditingRestaurant({...editingRestaurant, name: e.target.value})}
                    placeholder="Name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRestaurant.username || ''} 
                    onChange={e => setEditingRestaurant({...editingRestaurant, username: e.target.value})}
                    placeholder="Username"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRestaurant.password || ''} 
                    onChange={e => setEditingRestaurant({...editingRestaurant, password: e.target.value})}
                    placeholder="Password"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobile</label>
                  <input 
                    type="tel" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRestaurant.mobile || ''} 
                    onChange={e => setEditingRestaurant({...editingRestaurant, mobile: e.target.value})}
                    placeholder="Mobile"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commission %</label>
                  <input 
                    type="number" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRestaurant.commissionPercentage || 0} 
                    onChange={e => setEditingRestaurant({...editingRestaurant, commissionPercentage: Number(e.target.value)})}
                    placeholder="Commission %"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Address</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRestaurant.address || ''} 
                    onChange={e => setEditingRestaurant({...editingRestaurant, address: e.target.value})}
                    placeholder="Full Address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Latitude</label>
                  <input 
                    type="number" 
                    step="any"
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold text-xs" 
                    value={editingRestaurant.location?.lat || 0} 
                    onChange={e => setEditingRestaurant({...editingRestaurant, location: { ...editingRestaurant.location!, lat: Number(e.target.value) }})}
                    placeholder="Lat"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Longitude</label>
                  <input 
                    type="number" 
                    step="any"
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold text-xs" 
                    value={editingRestaurant.location?.lng || 0} 
                    onChange={e => setEditingRestaurant({...editingRestaurant, location: { ...editingRestaurant.location!, lng: Number(e.target.value) }})}
                    placeholder="Lng"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-black text-white py-4 rounded-2xl font-black shadow-xl hover:bg-gray-900 transition">Update Shop</button>
                <button type="button" onClick={() => setEditingRestaurant(null)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-black hover:bg-gray-200 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rider Modal */}
      {editingRider && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl animate-slide-up">
            <h3 className="text-2xl font-black mb-6">Edit Rider</h3>
            <form onSubmit={saveEditedRider} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRider.name} 
                    onChange={e => setEditingRider({...editingRider, name: e.target.value})}
                    placeholder="Name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobile</label>
                  <input 
                    type="tel" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRider.mobile || ''} 
                    onChange={e => setEditingRider({...editingRider, mobile: e.target.value})}
                    placeholder="Mobile"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRider.username || ''} 
                    onChange={e => setEditingRider({...editingRider, username: e.target.value})}
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 rounded-2xl px-5 py-3 font-bold" 
                    value={editingRider.password || ''} 
                    onChange={e => setEditingRider({...editingRider, password: e.target.value})}
                    placeholder="Password"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-black text-white py-4 rounded-2xl font-black shadow-xl hover:bg-gray-900 transition">Update Rider</button>
                <button type="button" onClick={() => setEditingRider(null)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-black hover:bg-gray-200 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'network' && (
        <div className="space-y-12 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <section className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100">
              <h3 className="text-2xl font-black mb-8">Add Merchant</h3>
              <form onSubmit={handleCreateRestaurant} className="space-y-6">
                <input type="text" placeholder="Store Name" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={newResName} onChange={e => setNewResName(e.target.value)} required />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="User" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={newResUser} onChange={e => setNewResUser(e.target.value)} required />
                  <input type="password" placeholder="Pass" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={newResPass} onChange={e => setNewResPass(e.target.value)} required />
                </div>
                <button className="w-full bg-red-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-red-100">Onboard Merchant</button>
              </form>
            </section>

            <section className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100">
              <h3 className="text-2xl font-black mb-8">Add Rider</h3>
              <form onSubmit={handleCreateRider} className="space-y-6">
                <input type="text" placeholder="Full Name" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={newRiderName} onChange={e => setNewRiderName(e.target.value)} required />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input type="text" placeholder="User" className="w-full bg-gray-50 rounded-2xl px-5 py-4 font-bold border-none" value={newRiderUser} onChange={e => setNewRiderUser(e.target.value)} required />
                  <input type="password" placeholder="Pass" className="w-full bg-gray-50 rounded-2xl px-5 py-4 font-bold border-none" value={newRiderPass} onChange={e => setNewRiderPass(e.target.value)} required />
                  <input type="tel" placeholder="Mobile" className="w-full bg-gray-50 rounded-2xl px-5 py-4 font-bold border-none" value={newRiderMobile} onChange={e => setNewRiderMobile(e.target.value)} required />
                </div>
                <button className="w-full bg-black text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-gray-200">Onboard Rider</button>
              </form>
            </section>
          </div>

          <section className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100">
            <h3 className="text-2xl font-black mb-8">Live Network</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-4 block">Merchants</span>
                  {state.restaurants.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl group">
                       <div className="flex items-center gap-4">
                          <img src={r.profileImageUrl} className="w-12 h-12 rounded-full object-cover shadow-sm" alt="" />
                          <div>
                            <div className="font-black text-gray-800">{r.name}</div>
                            <div className="text-[9px] font-bold text-gray-400">@{r.username} • Comm: {r.commissionPercentage || 0}%</div>
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Total Comm: Rs.{merchantCommissions[r.id]?.toFixed(0)}</div>
                          </div>
                       </div>
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingRestaurant(r)}
                            className="p-2 bg-white rounded-xl text-blue-500 shadow-sm hover:bg-blue-50 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>
                          <button 
                            onClick={() => deleteRestaurant(r.id)}
                            className="p-2 bg-white rounded-xl text-red-500 shadow-sm hover:bg-red-50 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
               <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-4 block">Riders</span>
                  {state.riders.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl group">
                       <div className="flex items-center gap-4">
                          <img src={r.profileImageUrl} className="w-12 h-12 rounded-full object-cover shadow-sm" alt="" />
                          <div>
                            <div className="font-black text-gray-800">{r.name}</div>
                            <div className="text-[9px] font-bold text-gray-400">@{r.username}</div>
                          </div>
                       </div>
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingRider(r)}
                            className="p-2 bg-white rounded-xl text-blue-500 shadow-sm hover:bg-blue-50 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>
                          <button 
                            onClick={() => deleteRider(r.id)}
                            className="p-2 bg-white rounded-xl text-red-500 shadow-sm hover:bg-red-50 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-blue-600 text-white p-8 rounded-[40px] shadow-xl">
               <div className="text-4xl font-black mb-1">{state.orders.length}</div>
               <div className="text-[10px] font-black uppercase opacity-60 tracking-widest">Deliveries</div>
            </div>
            <div className="bg-green-500 text-white p-8 rounded-[40px] shadow-xl">
               <div className="text-4xl font-black mb-1">Rs.{state.orders.reduce((a,b)=>a+b.total, 0).toFixed(0)}</div>
               <div className="text-[10px] font-black uppercase opacity-60 tracking-widest">Revenue</div>
            </div>
            <div className="bg-red-500 text-white p-8 rounded-[40px] shadow-xl">
               <div className="text-4xl font-black mb-1">Rs.{state.orders.reduce((a,b)=>a+b.deliveryFee, 0).toFixed(0)}</div>
               <div className="text-[10px] font-black uppercase opacity-60 tracking-widest">Fee Revenue</div>
            </div>
            <div className="bg-black text-white p-8 rounded-[40px] shadow-xl">
               <div className="text-4xl font-black mb-1">{state.customers.length}</div>
               <div className="text-[10px] font-black uppercase opacity-60 tracking-widest">Members</div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'financials' && (
        <section className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 animate-fade-in">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-2xl font-black">Financial Reports</h3>
             <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50 px-4 py-2 rounded-full">Date-wise Settlement</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest px-4">Date</th>
                  <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest px-4">Food Sales</th>
                  <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest px-4">DialMe Commission</th>
                  <th className="pb-4 text-[10px] font-black uppercase text-gray-400 tracking-widest px-4">Shop Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dailyFinancials.map(day => (
                  <tr key={day.date} className="hover:bg-gray-50/50 transition">
                    <td className="py-5 px-4 font-black text-gray-800">{day.date}</td>
                    <td className="py-5 px-4 font-bold text-gray-500">Rs.{day.totalFoodSales.toFixed(0)}</td>
                    <td className="py-5 px-4 font-black text-red-500">Rs.{day.totalCommission.toFixed(0)}</td>
                    <td className="py-5 px-4 font-black text-emerald-600">Rs.{day.totalShopPayable.toFixed(0)}</td>
                  </tr>
                ))}
                {dailyFinancials.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center font-black text-gray-300 uppercase tracking-widest">No delivered orders found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="max-w-xl mx-auto bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 animate-fade-in">
           <h3 className="text-2xl font-black mb-8">Admin Settings</h3>
           <div className="p-6 bg-red-50 rounded-3xl mb-8 border border-red-100">
              <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-1">Security Alert</p>
              <p className="text-xs font-medium text-red-500">You are logged in with the default administrator account. For maximum security, please update your password below.</p>
           </div>
           
           <form onSubmit={handleAdminPassUpdate} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">New Administrator Password</label>
                 <input 
                    type="password" 
                    className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" 
                    value={newAdminPass} 
                    onChange={e => setNewAdminPass(e.target.value)} 
                    placeholder="Enter new secure password"
                    required
                 />
              </div>
              <button className="w-full bg-black text-white py-5 rounded-[20px] font-black text-lg shadow-xl shadow-gray-200 hover:bg-gray-900 transition">Update Security Password</button>
              {passSuccess && (
                <div className="text-center p-3 bg-green-50 rounded-2xl border border-green-100 animate-slide-up">
                   <p className="text-xs font-black text-green-600 uppercase tracking-widest">Password Updated Successfully!</p>
                </div>
              )}
           </form>
        </section>
      )}
    </div>
  );
};

export default AdminDashboard;
