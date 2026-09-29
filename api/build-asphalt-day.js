module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST required'});
  const key=process.env.GOOGLE_MAPS_API_KEY;
  if(!key) return res.status(503).json({error:'Google Maps is not configured on the server.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const target=Math.max(1,Number(body.targetTons)||36);
    let candidates=Array.isArray(body.candidates)?body.candidates.filter(x=>x&&x.id&&x.address&&Number(x.tons)>0):[];
    if(!candidates.length) return res.status(400).json({error:'No usable asphalt stops were supplied.'});
    if(candidates.length>120) return res.status(400).json({error:'Choose a project first; this view has too many stops to optimize at once.'});
    const geocoded=[];
    const geocode=async c=>{
      if(Number.isFinite(Number(c.latitude))&&Number.isFinite(Number(c.longitude))) return {...c,latitude:Number(c.latitude),longitude:Number(c.longitude)};
      const u='https://maps.googleapis.com/maps/api/geocode/json?address='+encodeURIComponent(c.address)+'&region=us&key='+encodeURIComponent(key);
      const r=await fetch(u),j=await r.json(),g=j.results&&j.results[0];
      if(!r.ok||!g) return null;
      const out={...c,latitude:g.geometry.location.lat,longitude:g.geometry.location.lng};
      geocoded.push({id:c.id,latitude:out.latitude,longitude:out.longitude,formattedAddress:g.formatted_address||c.address});
      return out;
    };
    const located=(await Promise.all(candidates.map(geocode))).filter(Boolean);
    if(!located.length) return res.status(400).json({error:'Google could not locate these addresses.'});
    const rad=x=>x*Math.PI/180;
    const miles=(a,b)=>{const R=3958.8,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude),q=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q))};
    let best=null;
    for(const seed of located){
      let route=[seed],tons=Number(seed.tons),remaining=located.filter(x=>x.id!==seed.id);
      while(route.length<10&&remaining.length){
        const center={latitude:route.reduce((s,x)=>s+x.latitude,0)/route.length,longitude:route.reduce((s,x)=>s+x.longitude,0)/route.length};
        const fit=remaining.filter(x=>tons+Number(x.tons)<=target*1.02).sort((a,b)=>miles(center,a)-miles(center,b));
        if(!fit.length) break;
        const n=fit[0];route.push(n);tons+=Number(n.tons);remaining=remaining.filter(x=>x.id!==n.id);
      }
      const spread=route.reduce((s,x)=>s+miles(seed,x),0)/Math.max(1,route.length);
      const score=Math.abs(target-tons)+spread*.45+(tons<target*.75?20:0);
      if(!best||score<best.score) best={route,tons,score};
    }
    let route=best.route;
    if(route.length>2){
      const origin=route[0],destination=route[route.length-1],inter=route.slice(1,-1);
      const rr=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex'},body:JSON.stringify({origin:{location:{latLng:{latitude:origin.latitude,longitude:origin.longitude}}},destination:{location:{latLng:{latitude:destination.latitude,longitude:destination.longitude}}},intermediates:inter.map(x=>({location:{latLng:{latitude:x.latitude,longitude:x.longitude}}})),travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',optimizeWaypointOrder:true})});
      const rj=await rr.json();
      if(!rr.ok) throw new Error(rj.error&&rj.error.message||'Google route optimization failed.');
      const gr=rj.routes&&rj.routes[0],order=gr&&gr.optimizedIntermediateWaypointIndex;
      if(Array.isArray(order)&&order.length===inter.length) route=[origin,...order.map(i=>inter[i]),destination];
      return res.status(200).json({order:route.map(x=>x.id),totalTons:best.tons,distanceMeters:gr&&gr.distanceMeters||0,durationSeconds:Number(String(gr&&gr.duration||'0s').replace('s',''))||0,geocoded});
    }
    return res.status(200).json({order:route.map(x=>x.id),totalTons:best.tons,distanceMeters:0,durationSeconds:0,geocoded});
  }catch(e){return res.status(500).json({error:e.message||'Route build failed.'})}
};