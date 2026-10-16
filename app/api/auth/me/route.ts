import {createHmac,timingSafeEqual} from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const raw=(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("atlas_session="));
 if(!raw)return Response.json({error:"Not signed in"},{status:401});
 try{
  const [b64,exp,sig]=decodeURIComponent(raw.slice("atlas_session=".length)).split(".");
  if(Number(exp)<Date.now())throw Error();
  const expected=createHmac("sha256",process.env.AUTH_SECRET||"").update(`${b64}.${exp}`).digest("base64url");
  if(expected.length!==sig.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))throw Error();
  const p=JSON.parse(Buffer.from(b64,"base64url").toString());
  return Response.json({email:String(p.e||""),name:String(p.n||""),picture:String(p.p||"")},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Not signed in"},{status:401})}
}
