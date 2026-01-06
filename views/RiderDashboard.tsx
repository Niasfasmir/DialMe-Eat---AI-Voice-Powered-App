
import React, { useState } from 'react';
import { GlobalState, OrderStatus, EntityStatus, Restaurant, Customer } from '../types';
import { GoogleGenAI } from '@google/genai';

interface Props {
  state: GlobalState;
  updateState: (updater: (prev: GlobalState) => GlobalState) => void;
}

const RiderDashboard: React.FC<Props> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'profile'>('tasks');
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const me = state.riders.find(r => r.id === state.loggedInRiderId);
  
  const [profileForm, setProfileForm] = useState({
    name: me?.name || '',
    username: me?.username || '',
    password: me?.password || '',
    mobile: me?.mobile || ''
  });

  if (!me) return null;

  const assignedOrders = state.orders.filter(o => o.riderId === me.id && o.status !== OrderStatus.DELIVERED);
  const completedOrders = state.orders.filter(o => o.riderId === me.id && o.status === OrderStatus.DELIVERED);
  const pendingPickup = state.orders.filter(o => (o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.PREPARING || o.status === OrderStatus.READY) && !o.riderId);

  const handleUpdateStatus = (orderId: string, next: OrderStatus) => {
    updateState(s => ({ ...s, orders: s.orders.map(o => o.id === orderId ? { ...o, status: next } : o) }));
  };

  const handleAcceptOrder = (orderId: string) => {
    updateState(s => ({ ...s, orders: s.orders.map(o => o.id === orderId ? { ...o, riderId: me.id } : o) }));
  };

  const regenerateProfile = async () => {
    setIsGeneratingProfile(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A professional portrait of a delivery rider named ${me.name}, wearing a delivery jacket, outdoor setting, friendly expression, hyper-realistic.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        updateState(s => ({ ...s, riders: s.riders.map(r => r.id === me.id ? { ...r, profileImageUrl: imageUrl } : r) }));
      }
    } catch (e) { console.error(e); }
    setIsGeneratingProfile(false);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateState(s => ({ 
      ...s, 
      riders: s.riders.map(r => r.id === me.id ? { ...r, ...profileForm } : r) 
    }));
    alert('Profile updated successfully!');
  };

  if (me.status !== EntityStatus.APPROVED) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 animate-fade-in">
        <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 mb-6 border-4 border-white shadow-xl text-4xl font-black">!</div>
        <h3 className="text-2xl font-black mb-2">Registration Pending</h3>
        <p className="text-gray-500 font-medium">Under review by DialMe Eat admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden flex-shrink-0">
              <img src={me.profileImageUrl} className="w-full h-full object-cover" alt="" />
           </div>
           <div>
              <h2 className="text-3xl font-black">{me.name}</h2>
              <div className="flex gap-2 mt-2">
                 <button onClick={() => setActiveTab('tasks')} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition ${activeTab === 'tasks' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>Tasks</button>
                 <button onClick={() => setActiveTab('profile')} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition ${activeTab === 'profile' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>Profile</button>
              </div>
           </div>
        </div>
        <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100 flex items-center gap-6">
          <div><div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Earnings</div><div className="text-2xl font-black text-red-500">Rs.{completedOrders.reduce((a,b)=>a+b.deliveryFee, 0)}</div></div>
        </div>
      </header>

      {activeTab === 'tasks' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <section className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100">
            <h3 className="text-xl font-black mb-8">My Deliveries</h3>
            <div className="space-y-6">
              {assignedOrders.map(order => {
                const restaurant = state.restaurants.find(r => r.id === order.restaurantId);
                const customer = state.customers.find(c => c.id === order.customerId);

                return (
                  <div key={order.id} className="p-6 bg-gray-50 rounded-[30px] border border-gray-100 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-lg">Order #{order.id.slice(-4).toUpperCase()}</h4>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Task</div>
                      </div>
                      <span className="text-[9px] font-black px-3 py-1.5 bg-white rounded-full border border-gray-200 uppercase tracking-widest h-fit">{order.status}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-y border-gray-200/50">
                      <div className="space-y-1">
                        <div className="text-[9px] font-black text-red-500 uppercase tracking-widest">Pickup From</div>
                        <div className="font-black text-sm text-gray-800">{restaurant?.name || 'Unknown Restaurant'}</div>
                        <div className="text-xs font-bold text-gray-500">{restaurant?.mobile || 'No Phone'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Deliver To</div>
                        <div className="font-black text-sm text-gray-800">{customer?.name || 'Customer'}</div>
                        <div className="text-xs font-bold text-gray-500">{customer?.mobile || 'No Phone'}</div>
                        <div className="text-xs font-medium text-gray-400 leading-tight">{customer?.address || 'No Address Provided'}</div>
                      </div>
                    </div>

                    <div className="pt-2">
                      {order.status === OrderStatus.READY && (
                        <button 
                          onClick={() => handleUpdateStatus(order.id, OrderStatus.OUT_FOR_DELIVERY)} 
                          className="w-full bg-red-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-100 hover:bg-red-600 transition"
                        >
                          Confirm Pickup
                        </button>
                      )}
                      {order.status === OrderStatus.OUT_FOR_DELIVERY && (
                        <button 
                          onClick={() => handleUpdateStatus(order.id, OrderStatus.DELIVERED)} 
                          className="w-full bg-green-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-green-100 hover:bg-green-600 transition"
                        >
                          Complete Delivery
                        </button>
                      )}
                      {(order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PREPARING) && (
                        <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                          <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Waiting for restaurant to mark as ready</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {assignedOrders.length === 0 && <div className="text-center py-20 bg-gray-50 rounded-[30px] border-2 border-dashed border-gray-100 font-black text-gray-300 uppercase text-xs tracking-widest">No active tasks</div>}
            </div>
          </section>
          
          <section className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black">Open Pool</h3>
              {pendingPickup.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{pendingPickup.length} New Orders</span>
                </div>
              )}
            </div>
            <div className="space-y-6">
              {pendingPickup.map(order => (
                <div key={order.id} className="p-6 border border-gray-100 rounded-[30px] flex items-center justify-between group hover:border-red-200 transition-all">
                  <div>
                    <div className="font-black text-gray-800">{state.restaurants.find(r => r.id === order.restaurantId)?.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                      {order.distance} km away • Rs.{order.deliveryFee} Fee
                    </div>
                    {order.status === OrderStatus.READY && (
                       <span className="text-[8px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase mt-2 inline-block">Ready for Pickup</span>
                    )}
                  </div>
                  <button onClick={() => handleAcceptOrder(order.id)} className="bg-black text-white px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-red-500 transition shadow-xl">Accept</button>
                </div>
              ))}
              {pendingPickup.length === 0 && <div className="text-center py-20 bg-gray-50 rounded-[30px] border-2 border-dashed border-gray-100 font-black text-gray-300 uppercase text-xs tracking-widest">No orders nearby</div>}
            </div>
          </section>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm max-w-2xl mx-auto space-y-10">
           <div className="flex flex-col items-center gap-8 border-b border-gray-50 pb-10 text-center">
              <div className="relative">
                 <div className="w-32 h-32 rounded-full border-4 border-gray-100 shadow-2xl overflow-hidden"><img src={me.profileImageUrl} className="w-full h-full object-cover" alt="" /></div>
                 <button onClick={regenerateProfile} disabled={isGeneratingProfile} className="absolute -bottom-2 -right-2 bg-black text-white p-3 rounded-2xl hover:bg-red-500 transition disabled:opacity-50 shadow-xl">
                    {isGeneratingProfile ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>}
                 </button>
              </div>
              <div><h3 className="text-3xl font-black">{me.name}</h3><p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-2">Rider Account</p></div>
           </div>
           <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Display Name</label>
                  <input type="text" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobile</label>
                  <input type="tel" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={profileForm.mobile} onChange={e => setProfileForm({...profileForm, mobile: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                  <input type="text" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={profileForm.username} onChange={e => setProfileForm({...profileForm, username: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                  <input type="password" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-black text-white py-5 rounded-[20px] font-black text-lg shadow-xl hover:bg-gray-900 transition">Update Rider Profile</button>
           </form>
        </div>
      )}
    </div>
  );
};

export default RiderDashboard;
