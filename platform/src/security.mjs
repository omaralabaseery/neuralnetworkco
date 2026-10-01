const encoder = new TextEncoder();
export const hex = bytes => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(text) { return hex(await crypto.subtle.digest('SHA-256',encoder.encode(text))); }
export const token = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function hashPassword(password,salt=token()) {
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const hash=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256);
 return `pbkdf2$100000$${salt}$${hex(hash)}`;
}
export async function verifyPassword(password,stored){
 const parts=stored.split('$');if(parts.length!==4||parts[0]!=='pbkdf2'||parts[1]!=='100000')return false;
 const actual=await hashPassword(password,parts[2]);let diff=actual.length^stored.length;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^(stored.charCodeAt(i)||0);return diff===0;
}
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export function requireRole(user,roles){if(!user)throw new HttpError(401,'Please sign in.');if(!roles.includes(user.role))throw new HttpError(403,'You do not have permission.');}
export const staffRoles=['owner','admin','sales','manager'];
export function localMode(env,request){return env.LOCAL_TEST==='true'&&['localhost','127.0.0.1'].includes(new URL(request.url).hostname);}
export function checkOrigin(req,env){const origin=req.headers.get('Origin');const allowed=localMode(env,req)?new URL(req.url).origin:env.PUBLIC_ORIGIN;if(!allowed||origin!==allowed)throw new HttpError(403,'Untrusted request origin.');}
export async function limited(env,key,max=10,seconds=900){
 const now=Math.floor(Date.now()/1000);const bucket=Math.floor(now/seconds);const hash=await digest(`${key}:${bucket}`);
 const row=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(hash,now+seconds).first();
 if(row.count>max)throw new HttpError(429,'Too many attempts. Please try again later.');
}
export async function challenge(req,env,proof){
 if(localMode(env,req))return;
 if(!env.TURNSTILE_SECRET_KEY||!proof)throw new HttpError(503,'Verification is not configured or incomplete.');
 const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:proof,remoteip:req.headers.get('CF-Connecting-IP')||''})}).then(r=>r.json());
 if(!result.success||result.hostname!==new URL(env.PUBLIC_ORIGIN).hostname)throw new HttpError(400,'Verification failed. Please try again.');
}
export async function getUser(req,env){const raw=req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-nn_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!raw)return null;return env.DB.prepare('SELECT u.id,u.name,u.email,u.phone,u.company,u.role,u.email_verified FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(await digest(raw),Math.floor(Date.now()/1000)).first();}
export async function startSession(env,user){const raw=token();const age=user.role==='client'?604800:43200;await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(raw),user.id,Math.floor(Date.now()/1000)+age).run();return `__Host-nn_session=${raw}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;}
export async function logout(req,env){const raw=req.headers.get('Cookie')?.match(/__Host-nn_session=([a-f0-9]{64})/)?.[1];if(raw)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(raw)).run();return '__Host-nn_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';}
export const safeUser = u => ({id:u.id,name:u.name,email:u.email,phone:u.phone,company:u.company,role:u.role,email_verified:u.email_verified});
