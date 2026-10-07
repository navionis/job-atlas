import {snapshot} from "../../../lib/feeds";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){try{return Response.json(await snapshot(),{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({error:"Feed storage unavailable. Check server DATA_DIR permissions and state file."},{status:503})}}
