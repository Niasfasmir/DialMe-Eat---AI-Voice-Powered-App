
import React, { useState, useMemo } from 'react';
import { GlobalState, OrderStatus, MenuItem, Customer, EntityStatus, LatLng } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { useAudioSession } from '../hooks/useAudioSession';
import { Icons } from '../constants';

interface Props {
  state: GlobalState;
  updateState: (updater: (prev: GlobalState) => GlobalState) => void;
}

const RestaurantDashboard: React.FC<Props> = ({ state, updateState }) => {
  const { startSession, stopSession, isActive, transcription, clearTranscription } = useAudioSession();
  const [activeTab, setActiveTab] = useState<'manage' | 'orders' | 'settings'>('orders');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({ name: '', price: 0, description: '', category: 'General' });
  const [newCategoryName, setNewCategoryName] = useState('');

  const myRestaurant = state.restaurants.find(r => r.id === state.loggedInRestaurantId);
  const restaurantOrders = state.orders.filter(o => o.restaurantId === state.loggedInRestaurantId);

  const [settingsForm, setSettingsForm] = useState({
    name: myRestaurant?.name || '',
    username: myRestaurant?.username || '',
    password: myRestaurant?.password || '',
    mobile: myRestaurant?.mobile || '',
    address: myRestaurant?.address || '',
    commissionPercentage: myRestaurant?.commissionPercentage || 0,
    location: myRestaurant?.location || { lat: 0, lng: 0 }
  });

  const availableCategories = useMemo(() => {
    const cats = new Set<string>(['General', 'Starters', 'Mains', 'Desserts', 'Drinks']);
    myRestaurant?.categories?.forEach(c => cats.add(c));
    myRestaurant?.items.forEach(i => cats.add(i.category));
    return Array.from(cats);
  }, [myRestaurant]);

  const itemsByCategory = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    myRestaurant?.items.forEach(item => {
      const cat = item.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [myRestaurant]);

  const generateItemImage = async (name: string, description: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A hyper-realistic professional food photography of ${name}. ${description}. 4k resolution, studio lighting, appetizing presentation.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : undefined;
    } catch (e) {
      console.error("Image generation failed", e);
      return undefined;
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myRestaurant) return;

    let imageUrl = newItem.imageUrl;
    if (newItem.description && !imageUrl) {
        setIsGeneratingImage(true);
        imageUrl = await generateItemImage(newItem.name || '', newItem.description);
        setIsGeneratingImage(false);
    }

    const item: MenuItem = {
        id: editingItem?.id || 'item-' + Date.now(),
        name: newItem.name || '',
        price: Number(newItem.price) || 0,
        description: newItem.description || '',
        category: newItem.category || 'General',
        imageUrl: imageUrl
    };

    updateState(s => ({
      ...s,
      restaurants: s.restaurants.map(r => r.id === myRestaurant.id ? {
        ...r,
        items: editingItem 
            ? r.items.map(i => i.id === editingItem.id ? item : i)
            : [...r.items, item]
      } : r)
    }));

    setNewItem({ name: '', price: 0, description: '', category: 'General' });
    setEditingItem(null);
  };

  const handleRegenerateItemImage = async (item: MenuItem) => {
      setIsGeneratingImage(true);
      const url = await generateItemImage(item.name, item.description);
      if (url) {
          updateState(s => ({
              ...s,
              restaurants: s.restaurants.map(r => r.id === myRestaurant?.id ? {
                  ...r,
                  items: r.items.map(i => i.id === item.id ? { ...i, imageUrl: url } : i)
              } : r)
          }));
      }
      setIsGeneratingImage(false);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !myRestaurant) return;
    updateState(s => ({
      ...s,
      restaurants: s.restaurants.map(r => r.id === myRestaurant.id ? {
        ...r,
        categories: [...(r.categories || []), newCategoryName.trim()]
      } : r)
    }));
    setNewCategoryName('');
  };

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myRestaurant) return;
    updateState(s => ({
      ...s,
      restaurants: s.restaurants.map(r => r.id === myRestaurant.id ? { ...r, ...settingsForm } : r)
    }));
    alert('Shop settings updated!');
  };

  const detectLocation = () => {
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setSettingsForm(prev => ({ ...prev, location: newLoc }));
        setIsDetectingLocation(false);
      },
      (error) => {
        console.error("Location detection failed", error);
        setIsDetectingLocation(false);
      }
    );
  };

  const regenerateStoreImage = async () => {
    if (!myRestaurant) return;
    setIsGeneratingProfile(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A modern high-end restaurant facade for a shop named ${myRestaurant.name}, inviting atmosphere, architectural photography style.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        updateState(s => ({
          ...s,
          restaurants: s.restaurants.map(r => r.id === myRestaurant.id ? { ...r, profileImageUrl: imageUrl } : r)
        }));
      }
    } catch (e) { console.error(e); }
    setIsGeneratingProfile(false);
  };

  const handleVoiceSetup = async () => {
    if (isActive) { stopSession(); return; }
    if (!myRestaurant) return;
    clearTranscription();
    const systemInstruction = `You are the Merchant Assistant for "${myRestaurant.name}". Access to Live DB. Sri Lankan Tamil only. Support categories: ${availableCategories.join(', ')}.`;
    const tools = [{ 
        functionDeclarations: [{ 
            name: 'addMenuItem', 
            parameters: { 
                type: Type.OBJECT, 
                properties: { 
                    name: { type: Type.STRING }, 
                    price: { type: Type.NUMBER }, 
                    description: { type: Type.STRING },
                    category: { type: Type.STRING }
                }, 
                required: ['name', 'price'] 
            } 
        }] 
    }];
    startSession({
      systemInstruction,
      tools,
      onFunctionCall: async (name, args) => {
        if (name === 'addMenuItem') {
          setIsGeneratingImage(true);
          const imageUrl = await generateItemImage(args.name, args.description || args.name);
          setIsGeneratingImage(false);
          updateState(s => ({ 
              ...s, 
              restaurants: s.restaurants.map(r => r.id === s.loggedInRestaurantId ? { 
                  ...r, 
                  items: [...r.items, { id: 'item-' + Date.now(), ...args, imageUrl }] 
              } : r) 
          }));
          return { status: "success" };
        }
        return { status: "success" };
      }
    });
  };

  if (!myRestaurant) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden flex-shrink-0">
              <img src={myRestaurant.profileImageUrl} className="w-full h-full object-cover" alt="" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-800">{myRestaurant.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase">Verified Merchant</span>
                 <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase">Comm: {myRestaurant.commissionPercentage || 0}%</span>
              </div>
           </div>
        </div>
        <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl self-start">
          <button onClick={() => setActiveTab('orders')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition ${activeTab === 'orders' ? 'bg-white shadow-sm text-red-500' : 'text-gray-500'}`}>Orders</button>
          <button onClick={() => setActiveTab('manage')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition ${activeTab === 'manage' ? 'bg-white shadow-sm text-red-500' : 'text-gray-500'}`}>Menu</button>
          <button onClick={() => setActiveTab('settings')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition ${activeTab === 'settings' ? 'bg-white shadow-sm text-red-500' : 'text-gray-500'}`}>Settings</button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {restaurantOrders.sort((a,b)=>b.createdAt-a.createdAt).map(order => {
            const foodSubtotal = order.total - order.deliveryFee;
            const commission = foodSubtotal * ((myRestaurant.commissionPercentage || 0) / 100);
            const netPayout = foodSubtotal - commission;

            // Group items to show quantity
            const itemCounts = order.items.reduce((acc, item) => {
              if (!acc[item.name]) {
                acc[item.name] = { count: 0, price: item.price };
              }
              acc[item.name].count += 1;
              return acc;
            }, {} as Record<string, { count: number; price: number }>);

            return (
              <div key={order.id} className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100 flex flex-col group hover:border-red-200 transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                      <img src={state.customers.find(c => c.id === order.customerId)?.profileImageUrl} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
                      <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Order ID</span><span className="text-2xl font-black">#{order.id.slice(-4).toUpperCase()}</span></div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-red-500">Rs.{netPayout.toFixed(0)}</span>
                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter mt-1">Net Payout</div>
                    <div className="text-[9px] font-black uppercase bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100 mt-2">{order.status}</div>
                  </div>
                </div>

                <div className="mb-6 space-y-2 pb-4 border-b border-gray-50">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Order Details</div>
                  {Object.entries(itemCounts).map(([name, data], idx) => (
                    <div key={idx} className="flex justify-between text-xs font-bold text-gray-700">
                      <span>{name} <span className="text-red-500 ml-1">x {data.count}</span></span>
                      <span>Rs.{(data.price * data.count).toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 pt-2 border-t border-dashed border-gray-100">
                    <span>Delivery Charge</span>
                    <span>Rs.{order.deliveryFee.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-gray-800 pt-2">
                    <span>Gross Total</span>
                    <span>Rs.{order.total.toFixed(0)}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  {order.status === OrderStatus.PLACED && <button onClick={() => updateState(s => ({ ...s, orders: s.orders.map(o => o.id === order.id ? { ...o, status: OrderStatus.CONFIRMED } : o) }))} className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-100 hover:bg-red-600">Confirm</button>}
                  {order.status === OrderStatus.CONFIRMED && <button onClick={() => updateState(s => ({ ...s, orders: s.orders.map(o => o.id === order.id ? { ...o, status: OrderStatus.PREPARING } : o) }))} className="flex-1 bg-black text-white py-4 rounded-2xl font-black text-xs uppercase">Prepare</button>}
                  {order.status === OrderStatus.PREPARING && <button onClick={() => updateState(s => ({ ...s, orders: s.orders.map(o => o.id === order.id ? { ...o, status: OrderStatus.READY } : o) }))} className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-black text-xs uppercase">Mark Ready</button>}
                </div>
              </div>
            );
          })}
          {restaurantOrders.length === 0 && <div className="col-span-full py-24 text-center border-4 border-dashed border-gray-100 rounded-[40px] font-black text-gray-300 uppercase tracking-widest">No Active Orders</div>}
        </div>
      ) : activeTab === 'manage' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           <div className="lg:col-span-1 space-y-6">
              <div className="bg-red-500 rounded-[40px] p-8 text-white shadow-2xl flex flex-col items-center text-center space-y-6 border-b-8 border-red-700">
                 <div className={`w-20 h-20 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/10 ${isActive ? 'animate-pulse scale-110' : ''} transition-transform`}><Icons.Mic /></div>
                 <button onClick={handleVoiceSetup} disabled={isGeneratingImage} className={`w-full py-5 rounded-[20px] font-black text-lg transition ${isActive ? 'bg-white text-red-500' : 'bg-black/20 hover:bg-black/30 backdrop-blur-md'} disabled:opacity-50`}>{isActive ? 'Stop Session' : 'AI Voice Entry'}</button>
              </div>

              <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-4">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{editingItem ? 'Edit Item' : 'Manual Add'}</h3>
                 <input type="text" placeholder="Item Name" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 text-sm font-bold border-none" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                 <input type="number" placeholder="Price (Rs.)" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 text-sm font-bold border-none" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />
                 
                 <select className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 text-sm font-bold border-none appearance-none" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>
                    {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                 </select>

                 <textarea placeholder="Description (AI uses this for images)" className="w-full bg-gray-50 rounded-2xl px-5 py-3.5 text-sm font-bold border-none h-24" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
                 
                 <div className="flex gap-2">
                    <button onClick={handleSaveItem} disabled={isGeneratingImage} className="flex-1 bg-black text-white py-4 rounded-2xl font-black text-sm uppercase flex items-center justify-center gap-2">
                        {isGeneratingImage ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : editingItem ? 'Update' : 'Save'}
                    </button>
                    {editingItem && (
                        <button onClick={() => { setEditingItem(null); setNewItem({name:'', price:0, description:'', category:'General'}); }} className="bg-gray-100 text-gray-500 px-4 py-4 rounded-2xl font-black text-sm uppercase">×</button>
                    )}
                 </div>
              </div>

              <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm space-y-4">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Manage Categories</h3>
                 <div className="flex gap-2">
                    <input type="text" placeholder="New category..." className="flex-1 bg-gray-50 rounded-2xl px-5 py-3.5 text-sm font-bold border-none" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                    <button onClick={handleAddCategory} className="bg-gray-100 p-4 rounded-2xl font-black text-lg">+</button>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-3 space-y-12">
              {Object.entries(itemsByCategory).length === 0 ? (
                <div className="bg-white rounded-[40px] p-24 text-center border-4 border-dashed border-gray-100 font-black text-gray-300 uppercase tracking-[0.2em]">Menu is Empty</div>
              ) : (
                Object.entries(itemsByCategory).map(([category, items]) => (
                  <section key={category} className="space-y-6">
                    <h3 className="text-2xl font-black text-gray-800 ml-4 flex items-center gap-3">
                      <span className="w-12 h-1 bg-red-500 rounded-full"></span>
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {items.map(item => {
                        const payout = item.price * (1 - (myRestaurant.commissionPercentage || 0) / 100);
                        return (
                        <div key={item.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative group hover:border-red-200 transition-all">
                          <div className="h-48 bg-gray-100 rounded-2xl mb-4 overflow-hidden relative">
                             {item.imageUrl ? (
                               <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center opacity-20"><Icons.Food /></div>
                             )}
                             <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingItem(item); setNewItem(item); }} className="bg-white/80 backdrop-blur-md p-2 rounded-xl shadow-sm text-blue-500 hover:bg-blue-500 hover:text-white transition">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                </button>
                                <button onClick={() => handleRegenerateItemImage(item)} className="bg-white/80 backdrop-blur-md p-2 rounded-xl shadow-sm text-green-500 hover:bg-green-500 hover:text-white transition">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </button>
                             </div>
                          </div>
                          <div className="flex justify-between items-start mb-1">
                             <h4 className="font-black text-lg">{item.name}</h4>
                             <div className="text-right">
                                <span className="text-red-500 font-black">Rs.{item.price}</span>
                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Net Payout: Rs.{payout.toFixed(0)}</div>
                             </div>
                          </div>
                          <p className="text-xs text-gray-400 font-medium line-clamp-2">{item.description || 'No description provided.'}</p>
                        </div>
                      )})}
                    </div>
                  </section>
                ))
              )}
           </div>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm space-y-10">
           <div className="flex flex-col md:flex-row items-center gap-8 pb-10 border-b border-gray-50">
              <div className="relative">
                 <div className="w-32 h-32 rounded-full border-4 border-gray-100 shadow-2xl overflow-hidden"><img src={myRestaurant.profileImageUrl} className="w-full h-full object-cover" alt="" /></div>
                 <button onClick={regenerateStoreImage} disabled={isGeneratingProfile} className="absolute -bottom-2 -right-2 bg-black text-white p-3 rounded-2xl hover:bg-red-500 transition disabled:opacity-50 shadow-xl">
                    {isGeneratingProfile ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>}
                 </button>
              </div>
              <div className="text-center md:text-left">
                 <h3 className="text-3xl font-black">{myRestaurant.name}</h3>
                 <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Store Configuration</p>
              </div>
           </div>
           
           <form onSubmit={handleUpdateSettings} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Store Name</label>
                  <input type="text" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={settingsForm.name} onChange={e => setSettingsForm({...settingsForm, name: e.target.value})} required />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Merchant Username</label>
                  <input type="text" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={settingsForm.username} onChange={e => setSettingsForm({...settingsForm, username: e.target.value})} required />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                  <input type="password" placeholder="Leave empty to keep current" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={settingsForm.password} onChange={e => setSettingsForm({...settingsForm, password: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobile Number</label>
                  <input type="tel" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={settingsForm.mobile} onChange={e => setSettingsForm({...settingsForm, mobile: e.target.value})} required />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commission Percentage (%)</label>
                  <input type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none opacity-60 cursor-not-allowed" value={settingsForm.commissionPercentage} disabled title="Commission can only be updated by Admin" />
                  <p className="text-[10px] text-gray-400 font-bold uppercase ml-1">Contact admin to change your 10% rate</p>
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Store Address</label>
                  <input type="text" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-bold border-none" value={settingsForm.address} onChange={e => setSettingsForm({...settingsForm, address: e.target.value})} required />
                </div>
              </div>

              <div className="bg-gray-50 rounded-[30px] p-6 border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h4 className="font-black text-sm mb-1 uppercase tracking-widest">Geolocation</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Lat: {settingsForm.location.lat.toFixed(6)}, Lng: {settingsForm.location.lng.toFixed(6)}</p>
                </div>
                <button 
                  type="button" 
                  onClick={detectLocation} 
                  disabled={isDetectingLocation}
                  className="bg-white border border-gray-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                >
                  {isDetectingLocation ? 'Detecting...' : 'Update Location'}
                </button>
              </div>

              <div className="pt-6 border-t border-gray-50">
                 <button type="submit" className="w-full bg-black text-white py-5 rounded-[20px] font-black text-lg shadow-xl hover:bg-gray-900 transition">Save Shop Settings</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
};

export default RestaurantDashboard;
