
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GlobalState, OrderStatus, MenuItem, Restaurant, EntityStatus, LatLng } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { useAudioSession } from '../hooks/useAudioSession';
import { Icons } from '../constants';

interface Props {
  state: GlobalState;
  updateState: (updater: (prev: GlobalState) => GlobalState) => void;
}

const CustomerDashboard: React.FC<Props> = ({ state, updateState }) => {
  const { startSession, stopSession, isActive, transcription, clearTranscription } = useAudioSession();
  const [activeTab, setActiveTab] = useState<'browse' | 'orders' | 'profile'>('browse');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<MenuItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const isOrderingRef = useRef(false);

  const me = state.customers.find(c => c.id === state.loggedInCustomerId);
  
  const sortedOrders = useMemo(() => {
    return state.orders
      .filter(o => o.customerId === state.loggedInCustomerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.orders, state.loggedInCustomerId]);

  const [profileForm, setProfileForm] = useState({
    name: me?.name || '',
    username: me?.username || '',
    mobile: me?.mobile || '',
    whatsapp: me?.whatsapp || '',
    address: me?.address || '',
    password: me?.password || ''
  });

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const calculateDistance = (p1: LatLng, p2: LatLng) => {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round((R * c) * 10) / 10;
  };

  const getDeliveryFee = (km: number) => km <= 3 ? 150 : 150 + Math.ceil(km - 3) * 50;

  const activeRestaurants = state.restaurants.filter(r => r.status === EntityStatus.APPROVED && r.items.length > 0);

  const generateProfileImage = async () => {
    if (!me) return;
    setIsGeneratingProfile(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A stylish 3D avatar profile picture of a person named ${me.name}, friendly expression, vibrant background, high-quality digital art style.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        updateState(s => ({
          ...s,
          customers: s.customers.map(c => c.id === me.id ? { ...c, profileImageUrl: imageUrl } : c)
        }));
      }
    } catch (e) { console.error(e); }
    setIsGeneratingProfile(false);
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;
    updateState(s => ({
      ...s,
      customers: s.customers.map(c => c.id === me.id ? { ...c, ...profileForm } : c)
    }));
    setSuccessMessage('Profile Updated Successfully!');
  };

  const handleVoiceOrder = () => {
    if (isActive) { stopSession(); return; }
    clearTranscription();
    isOrderingRef.current = false;

    // Build context for AI
    const simplifiedMenus = activeRestaurants.map(r => ({
      restaurant_id: r.id,
      restaurant_name: r.name,
      items: r.items.map(i => ({ name: i.name, price: i.price }))
    }));

    const systemInstruction = `
      நீ ஒரு DialMe Eat உணவு டெலிவரி உதவியாளர். பயனரின் பெயர்: ${me?.name}.
      
      முக்கிய விதிகள்:
      1. எப்போதும் தமிழில் (Sri Lankan Tamil style) மட்டும் பேசு.
      2. கிடைக்கும் உணவகங்கள் மற்றும் மெனு விவரங்கள் இதோ: ${JSON.stringify(simplifiedMenus)}.
      3. ஒரு ஆர்டரை எடுக்கும்போது, உணவகத்தின் பெயரையும் உணவின் பெயரையும் தெளிவாக உறுதிப்படுத்து.
      4. 'placeOrder' செயல்பாட்டைப் பயன்படுத்தி ஆர்டரை உறுதிசெய்.
      5. உணவகம் அல்லது உணவு மெனுவில் இல்லையென்றால், அதை மரியாதையுடன் பயனரிடம் தெரிவித்து மாற்று உணவை பரிந்துரை செய்.
      
      ஆர்டர் உறுதி செய்யப்பட்டால், "உங்கள் ஆர்டர் வெற்றிகரமாக பதிவு செய்யப்பட்டது" என்று சொல்.
    `;

    const tools = [{
      functionDeclarations: [
        {
          name: 'placeOrder',
          description: 'உணவகத்திலிருந்து உணவை ஆர்டர் செய்ய இதைப் பயன்படுத்துக.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              restaurantId: { type: Type.STRING, description: 'உணவகத்தின் தனித்துவமான ஐடி (ID)' },
              itemNames: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'ஆர்டர் செய்ய வேண்டிய உணவுகளின் பெயர்கள்' }
            },
            required: ['restaurantId', 'itemNames']
          }
        }
      ]
    }];

    startSession({
      systemInstruction,
      tools,
      onFunctionCall: async (name, args) => {
        if (name === 'placeOrder') {
          if (isOrderingRef.current) return { error: "ஏற்கனவே ஒரு ஆர்டர் செயல்பாட்டில் உள்ளது." };
          isOrderingRef.current = true;

          const restaurant = activeRestaurants.find(r => r.id === args.restaurantId);
          if (!restaurant) {
            isOrderingRef.current = false;
            return { error: "மன்னிக்கவும், அந்த உணவகத்தை எங்களால் கண்டுபிடிக்க முடியவில்லை." };
          }

          const items = args.itemNames.map((n: string) => 
            restaurant.items.find(i => i.name.toLowerCase().includes(n.toLowerCase()))
          ).filter(Boolean) as MenuItem[];

          if (items.length === 0) {
            isOrderingRef.current = false;
            return { error: "மன்னிக்கவும், நீங்கள் கேட்ட உணவுகள் அந்த உணவகத்தில் இல்லை." };
          }

          // Directly process the order
          processOrder(restaurant.id, items);
          
          // Keep Ref busy for a moment to prevent double calls from lingering audio context
          setTimeout(() => { isOrderingRef.current = false; }, 3000);
          
          return { 
            status: "success", 
            message: `${restaurant.name}-ல் உங்கள் ஆர்டர் பதிவு செய்யப்பட்டது. மொத்தம்: Rs.${items.reduce((a,b)=>a+b.price, 0)}` 
          };
        }
        return { status: "unknown_command" };
      }
    });
  };

  const processOrder = (restaurantId: string, items: MenuItem[]) => {
    if (!state.loggedInCustomerId || !me?.location) return;
    const restaurant = state.restaurants.find(r => r.id === restaurantId);
    if (!restaurant?.location) return;
    
    const dist = calculateDistance(me.location, restaurant.location);
    const fee = getDeliveryFee(dist);
    const subtotal = items.reduce((acc, i) => acc + i.price, 0);
    
    const newOrder = {
      id: 'ord-' + Math.random().toString(36).substr(2, 9),
      customerId: state.loggedInCustomerId,
      restaurantId,
      items: [...items],
      total: subtotal + fee,
      deliveryFee: fee,
      distance: dist,
      status: OrderStatus.PLACED,
      createdAt: Date.now()
    };

    updateState(s => ({
      ...s,
      orders: [...s.orders, newOrder]
    }));
    
    setCart([]);
    setSelectedRestaurant(null);
    setSuccessMessage(`ஆர்டர் பதிவு செய்யப்பட்டது: ${restaurant.name}`);
  };

  if (!me) return null;

  return (
    <div className="space-y-8 animate-fade-in relative pb-20 lg:pb-0">
      {/* Mobile Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 z-[100] lg:hidden">
        <button 
          onClick={handleVoiceOrder}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 ${isActive ? 'bg-white text-red-600 ring-4 ring-red-500/20 shadow-red-500/40' : 'bg-red-500 text-white shadow-red-500/20'}`}
        >
          <div className={isActive ? 'animate-pulse' : ''}>
            <Icons.Mic />
          </div>
          {isActive && (
            <div className="absolute -inset-2 rounded-full border-2 border-red-500/30 animate-ping"></div>
          )}
        </button>
      </div>

      {successMessage && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] bg-green-500 text-white px-10 py-5 rounded-[30px] font-black shadow-2xl animate-slide-down border-4 border-white">
          {successMessage}
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-500 rounded-[40px] p-8 md:p-16 text-white shadow-2xl border-b-8 border-red-700">
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
          <div className="relative group">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/30 overflow-hidden flex-shrink-0 shadow-2xl">
              <img src={me.profileImageUrl} className="w-full h-full object-cover" alt="Profile" />
            </div>
            {isGeneratingProfile && <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center animate-pulse"><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
          </div>
          <div className="max-w-2xl flex-grow text-center lg:text-left">
            <h2 className="text-3xl md:text-5xl font-black mb-2 leading-tight">வணக்கம், <span className="text-yellow-300">{me.name}!</span></h2>
            <div className="flex flex-wrap justify-center lg:justify-start gap-2 mt-4">
              <button onClick={() => setActiveTab('browse')} className={`px-5 py-2 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition ${activeTab === 'browse' ? 'bg-white text-red-600 shadow-xl' : 'bg-white/10 text-white hover:bg-white/20'}`}>Browse</button>
              <button onClick={() => setActiveTab('orders')} className={`px-5 py-2 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition ${activeTab === 'orders' ? 'bg-white text-red-600 shadow-xl' : 'bg-white/10 text-white hover:bg-white/20'}`}>Orders</button>
              <button onClick={() => setActiveTab('profile')} className={`px-5 py-2 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition ${activeTab === 'profile' ? 'bg-white text-red-600 shadow-xl' : 'bg-white/10 text-white hover:bg-white/20'}`}>Profile</button>
            </div>
          </div>
          <button onClick={handleVoiceOrder} className={`flex items-center justify-center gap-4 px-8 py-5 md:px-10 md:py-6 rounded-[30px] font-black text-xl md:text-2xl transition-all shadow-2xl ${isActive ? 'bg-white text-red-600 scale-105' : 'bg-black text-white hover:scale-105 border-2 border-white/20'}`}>
            <div className={isActive ? 'animate-pulse' : ''}><Icons.Mic /></div>
            <span>{isActive ? 'Listening...' : 'Order by Voice'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          {activeTab === 'browse' ? (
            selectedRestaurant ? (
              <div className="space-y-6">
                <button onClick={() => { setSelectedRestaurant(null); setCart([]); }} className="text-gray-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:text-red-500 transition">← Back to Stores</button>
                <div className="bg-white rounded-[40px] p-6 md:p-10 border border-gray-100 shadow-sm">
                  <h3 className="text-2xl md:text-3xl font-black mb-8">{selectedRestaurant.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedRestaurant.items.map(item => (
                      <div key={item.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col group hover:border-red-200 transition-all">
                        <div className="h-40 bg-gray-200 rounded-2xl mb-4 overflow-hidden relative">
                           {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center opacity-20"><Icons.Food /></div>}
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-black">{item.name}</div>
                            <div className="text-red-500 font-black">Rs.{item.price.toFixed(2)}</div>
                          </div>
                          <button onClick={() => setCart([...cart, item])} className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm group-hover:bg-red-500 group-hover:text-white transition-all">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {activeRestaurants.map(res => {
                  const dist = me.location && res.location ? calculateDistance(me.location, res.location) : 0;
                  return (
                    <div key={res.id} onClick={() => setSelectedRestaurant(res)} className="group bg-white rounded-[40px] p-6 shadow-sm border border-gray-100 cursor-pointer hover:border-red-200 transition-all">
                      <div className="h-48 bg-gray-50 rounded-[32px] mb-6 overflow-hidden relative border border-gray-50">
                        <img src={`https://picsum.photos/seed/${res.id}/400/300`} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt="" />
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl text-[10px] text-white font-black uppercase tracking-widest">{dist} km</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <h4 className="text-xl md:text-2xl font-black">{res.name}</h4>
                        <img src={res.profileImageUrl} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'orders' ? (
             <div className="space-y-6">
                <h3 className="text-2xl md:text-3xl font-black text-gray-800 px-4">Order History</h3>
                <div className="grid grid-cols-1 gap-6">
                   {sortedOrders.map(o => (
                     <div key={o.id} className="bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-6 w-full md:w-auto">
                           <div className="w-14 h-14 md:w-16 md:h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center font-black text-sm md:text-lg">#{o.id.slice(-4).toUpperCase()}</div>
                           <div>
                              <div className="font-black text-lg md:text-xl text-gray-800">{state.restaurants.find(res => res.id === o.restaurantId)?.name || 'Unknown Store'}</div>
                              <div className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">{o.items?.length || 0} Items • {new Date(o.createdAt).toLocaleDateString()}</div>
                           </div>
                        </div>
                        <div className="text-right flex flex-col items-center md:items-end w-full md:w-auto">
                           <div className="text-xl md:text-2xl font-black text-red-500">Rs.{o.total?.toFixed(0) || 0}</div>
                           <div className="text-[10px] font-black uppercase px-4 py-1.5 bg-gray-100 rounded-full mt-2 tracking-widest text-gray-500">{o.status}</div>
                        </div>
                     </div>
                   ))}
                   {sortedOrders.length === 0 && <div className="py-24 text-center border-4 border-dashed border-gray-100 rounded-[40px] font-black text-gray-300 uppercase tracking-widest">No orders yet</div>}
                </div>
             </div>
          ) : (
             <div className="bg-white rounded-[40px] p-6 md:p-10 border border-gray-100 shadow-sm space-y-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-gray-50 pb-10">
                   <div className="flex items-center gap-6">
                      <div className="relative">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-gray-100 shadow-xl overflow-hidden">
                           <img src={me.profileImageUrl} className="w-full h-full object-cover" alt="" />
                        </div>
                        <button onClick={generateProfileImage} disabled={isGeneratingProfile} className="absolute -bottom-2 -right-2 bg-black text-white p-2 rounded-xl shadow-xl hover:bg-red-500 transition disabled:opacity-50">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </button>
                      </div>
                      <div>
                         <h3 className="text-2xl md:text-3xl font-black">{me.name}</h3>
                         <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Personal Profile</p>
                      </div>
                   </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                      <input type="text" className="w-full bg-gray-50 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-800" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} required />
                   </div>
                   <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobile Number</label>
                      <input type="tel" className="w-full bg-gray-50 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-800" value={profileForm.mobile} onChange={e => setProfileForm({...profileForm, mobile: e.target.value})} required />
                   </div>
                   <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                      <input type="text" className="w-full bg-gray-50 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-800" value={profileForm.username} onChange={e => setProfileForm({...profileForm, username: e.target.value})} required />
                   </div>
                   <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                      <input type="password" placeholder="Update password" className="w-full bg-gray-50 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-800" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} required />
                   </div>
                   <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">WhatsApp</label>
                      <input type="tel" className="w-full bg-gray-50 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-800" value={profileForm.whatsapp} onChange={e => setProfileForm({...profileForm, whatsapp: e.target.value})} required />
                   </div>
                   <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Delivery Address</label>
                      <input type="text" className="w-full bg-gray-50 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-800" value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} required />
                   </div>
                   <div className="md:col-span-2 pt-6">
                      <button type="submit" className="w-full bg-black text-white py-5 rounded-[20px] font-black text-lg shadow-xl shadow-gray-100 hover:bg-gray-900 transition">Update My Details</button>
                   </div>
                </form>
             </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {isActive && (
            <div className="bg-black rounded-[40px] p-6 md:p-8 text-white shadow-2xl border-4 border-red-500/30">
              <div className="text-[10px] font-black tracking-widest text-red-500 uppercase mb-6 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>AI Assistant Active</div>
              <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-hide">
                {transcription.slice(-3).map((t, i) => <div key={i} className={`p-4 rounded-3xl border border-white/10 ${t.startsWith('[User]') ? 'bg-white/5' : 'bg-red-500/10'}`}><p className="text-xs font-medium leading-relaxed">{t}</p></div>)}
              </div>
            </div>
          )}
          {cart.length > 0 && selectedRestaurant && (
            <div className="bg-white rounded-[40px] p-8 shadow-2xl border-2 border-red-500 animate-slide-up">
              <h3 className="text-xl font-black mb-6">Order Summary</h3>
              <div className="space-y-4 mb-6">
                {cart.map((item, idx) => <div key={idx} className="flex justify-between text-sm font-bold"><span>{item.name}</span><span>Rs.{item.price.toFixed(0)}</span></div>)}
                <div className="pt-4 border-t flex justify-between text-xl font-black"><span>Total</span><span className="text-red-500">Rs.{cart.reduce((a,b)=>a+b.price, 0).toFixed(0)}</span></div>
              </div>
              <button onClick={() => processOrder(selectedRestaurant.id, cart)} className="w-full bg-red-500 text-white py-5 rounded-[20px] font-black text-lg">Confirm & Pay</button>
            </div>
          )}
          <h3 className="text-xl md:text-2xl font-black text-gray-800">Quick Stats</h3>
          <div className="bg-white rounded-[40px] p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center font-black">{sortedOrders.length}</div>
                <div><div className="text-[10px] font-black uppercase text-gray-400">Total Orders</div><div className="text-base md:text-lg font-black">Past Month</div></div>
             </div>
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center font-black">Rs.</div>
                <div><div className="text-[10px] font-black uppercase text-gray-400">Total Spent</div><div className="text-base md:text-lg font-black">{sortedOrders.reduce((a,b)=>a+b.total, 0).toFixed(0)} LKR</div></div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
