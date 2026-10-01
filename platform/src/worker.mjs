import {HttpError,digest,hashPassword,verifyPassword,getUser,startSession,logout,checkOrigin,limited,challenge,staffRoles,requireRole,safeUser,localMode} from './security.mjs';
import {body,text,email,password,choice,date,leadStages,projectStages,taskStages} from './validation.mjs';
const id=()=>crypto.randomUUID();
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const roles={crm:['owner','admin','sales'],work:['owner','admin','manager']};
const sql=(env,q,...v)=>env.DB.prepare(q).bind(...v);
const all=async (env,q,...v)=>(await sql(env,q,...v).all()).results;
const audit=(env,user,action,entity)=>sql(env,'INSERT INTO audit(id,actor_id,action,entity_id) VALUES (?,?,?,?)',id(),user.id,action,entity);
async function existing(env,table,key){if(!['requests','projects','tasks','users'].includes(table))throw Error('Invalid table');const item=await sql(env,`SELECT * FROM ${table} WHERE id=?`,key).first();if(!item)throw new HttpError(404,'Record not found.');return item;}
async function reference(env,table,value,role){if(!value)return null;const item=await existing(env,table,value);if(role==='staff'&&!staffRoles.includes(item.role)||role==='client'&&item.role!=='client'||table==='users'&&!item.active)throw new HttpError(400,'Invalid account selection.');return item;}
async function api(req,env,url){
 const path=url.pathname,method=req.method,ip=req.headers.get('CF-Connecting-IP')||'unknown';
 if(!env.DB)throw new HttpError(503,'Database is not configured.');
 if(!['GET','HEAD'].includes(method))checkOrigin(req,env);
 const user=await getUser(req,env);
 if(path==='/api/config'&&method==='GET')return json({available:localMode(env,req)||Boolean(env.PUBLIC_ORIGIN===url.origin&&env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY&&!env.TURNSTILE_SITE_KEY.startsWith('REPLACE_')),siteKey:env.TURNSTILE_SITE_KEY||'',local:localMode(env,req)});
 if(path==='/api/me'&&method==='GET')return json({user:user?safeUser(user):null});
 if(path==='/api/auth/logout'&&method==='POST')return json({ok:true},200,{'Set-Cookie':await logout(req,env)});
 if(path==='/api/auth/register'&&method==='POST'){
  await limited(env,'register:'+ip,5,3600);const b=await body(req);await challenge(req,env,text(b,'proof',4096));
  if(b.consent!==true)throw new HttpError(400,'Please accept account data processing.');
  const data={id:id(),name:text(b,'name',150,true),email:email(b),phone:text(b,'phone',35),company:text(b,'company',200),role:'client',email_verified:0};
  const hash=await hashPassword(password(b));
  if(await sql(env,'SELECT id FROM users WHERE email=?',data.email).first())throw new HttpError(409,'Unable to create account. Try signing in or contact the company.');
  await sql(env,'INSERT INTO users(id,name,email,phone,company,password_hash) VALUES (?,?,?,?,?,?)',data.id,data.name,data.email,data.phone,data.company,hash).run();
  return json({user:data},201,{'Set-Cookie':await startSession(env,data)});
 }
 if(path==='/api/auth/login'&&method==='POST'){
  await limited(env,'login:'+ip,15,900);const b=await body(req);const address=email(b);await limited(env,'login-email:'+address,10,900);await challenge(req,env,text(b,'proof',4096));
  const account=await sql(env,'SELECT * FROM users WHERE email=?',address).first();
  const valid=await verifyPassword(password(b),account?.password_hash||'pbkdf2$100000$0000000000000000000000000000000000000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000');
  if(!account||!valid||!account.active)throw new HttpError(401,'Invalid email or password.');
  return json({user:safeUser(account)},200,{'Set-Cookie':await startSession(env,account)});
 }
 if(path==='/api/auth/password'&&method==='POST'){
  requireRole(user,[...staffRoles,'client']);await limited(env,'password:'+user.id,5,900);const b=await body(req);const account=await existing(env,'users',user.id);
  if(!await verifyPassword(password({password:b.currentPassword}),account.password_hash))throw new HttpError(400,'Current password is incorrect.');
  const hash=await hashPassword(password(b));await env.DB.batch([sql(env,'UPDATE users SET password_hash=? WHERE id=?',hash,user.id),sql(env,'DELETE FROM sessions WHERE user_id=?',user.id),audit(env,user,'password.changed',user.id)]);
  return json({ok:true},200,{'Set-Cookie':await startSession(env,user)});
 }
 if(path==='/api/events'&&method==='POST'){
  await limited(env,'events:'+ip,180,3600);const b=await body(req);if(b.consent!==true)return json({ok:true});
  const event=choice(b,'event',['page_view','service_view','project_start','project_submit','contact_click']);
  const visitor=text(b,'visitor',64,true);if(!/^[a-zA-Z0-9-]{20,64}$/.test(visitor))throw new HttpError(400,'Invalid analytics identifier.');
  const page=choice(b,'page',['home','services','contact','portal'],'home');
  await sql(env,'INSERT INTO events(id,visitor_hash,event,page) VALUES (?,?,?,?)',id(),await digest(visitor),event,page).run();return json({ok:true},201);
 }
 if(path==='/api/requests'&&method==='POST'){
  await limited(env,'request:'+ip,8,3600);const b=await body(req);if(text(b,'website',200))throw new HttpError(400,'Invalid request.');if(!user)await challenge(req,env,text(b,'proof',4096));
  if(b.consent!==true)throw new HttpError(400,'Please allow us to contact you about this request.');
  const contact={id:id(),name:text(b,'name',150,true),company:text(b,'company',200),email:email(b,false),phone:text(b,'phone',35),country:text(b,'country',100)};
  if(!contact.email&&!/^[+\d() .-]{7,35}$/.test(contact.phone))throw new HttpError(400,'Provide a valid email or phone number.');
  if(contact.phone&&!/^[+\d() .-]{7,35}$/.test(contact.phone))throw new HttpError(400,'Invalid phone.');
  const requestId=id();const service=text(b,'service',100,true),description=text(b,'description',5000,true),budget=text(b,'budget',100);
  const source=user?'customer_portal':'website';
  await env.DB.batch([
   sql(env,'INSERT INTO contacts(id,name,company,email,phone,country,source,marketing_opt_in) VALUES (?,?,?,?,?,?,?,?)',contact.id,contact.name,contact.company,contact.email,contact.phone,contact.country,source,b.marketingOptIn===true?1:0),
   sql(env,'INSERT INTO requests(id,contact_id,user_id,service,description,budget,source,utm_source,utm_medium,utm_campaign) VALUES (?,?,?,?,?,?,?,?,?,?)',requestId,contact.id,user?.role==='client'?user.id:null,service,description,budget,source,text(b,'utmSource',150),text(b,'utmMedium',150),text(b,'utmCampaign',150))
  ]);return json({ok:true,id:requestId},201);
 }
 // All remaining endpoints require authentication; table names below are fixed by route.
 requireRole(user,[...staffRoles,'client']);
 if(method!=='GET')await limited(env,'write:'+user.id,120,3600);
 if(path==='/api/requests'&&method==='GET'){
  const page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1)),offset=(page-1)*50;
  const condition=user.role==='client'?'WHERE r.user_id=?':'';
  const params=user.role==='client'?[user.id]:[];
  return json({items:await all(env,`SELECT r.*,c.name,c.company,c.email,c.phone,c.country FROM requests r JOIN contacts c ON c.id=r.contact_id ${condition} ORDER BY r.created_at DESC,r.id DESC LIMIT 50 OFFSET ?`,...params,offset),page});
 }
 const requestMatch=path.match(/^\/api\/requests\/([a-f0-9-]{36})(\/notes)?$/);
 if(requestMatch){requireRole(user,roles.crm);const row=await existing(env,'requests',requestMatch[1]);
  if(requestMatch[2]){
   if(method==='GET')return json({items:await all(env,'SELECT n.*,u.name AS author FROM notes n JOIN users u ON u.id=n.author_id WHERE request_id=? ORDER BY n.created_at DESC',row.id)});
   if(method==='POST'){const b=await body(req),note=id();await env.DB.batch([sql(env,'INSERT INTO notes(id,request_id,author_id,body) VALUES (?,?,?,?)',note,row.id,user.id,text(b,'body',3000,true)),audit(env,user,'request.note_added',row.id)]);return json({ok:true},201);}
  }else if(method==='PATCH'){const b=await body(req),status=choice(b,'status',leadStages,row.status);const assigned=b.assignee_id===undefined?row.assignee_id:text(b,'assignee_id',36)||null;await reference(env,'users',assigned,'staff');await env.DB.batch([sql(env,'UPDATE requests SET status=?,assignee_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',status,assigned,row.id),audit(env,user,'request.updated',row.id)]);return json({ok:true});}
 }
 if(path==='/api/overview'&&method==='GET'){
  requireRole(user,staffRoles);const totals=await sql(env,`SELECT (SELECT count(*) FROM requests) AS requests,(SELECT count(*) FROM requests WHERE status NOT IN ('Won','Lost')) AS open_leads,(SELECT count(*) FROM users WHERE role='client') AS accounts,(SELECT count(*) FROM projects WHERE status!='Completed') AS active_projects,(SELECT count(*) FROM tasks WHERE status!='Done') AS open_tasks,(SELECT count(DISTINCT visitor_hash) FROM events WHERE created_at>=datetime('now','-30 days')) AS tracked_browsers`).first();
  return json({totals,pipeline:await all(env,'SELECT status,count(*) AS count FROM requests GROUP BY status'),events:await all(env,"SELECT event,count(*) AS count FROM events WHERE created_at>=datetime('now','-30 days') GROUP BY event"),sources:await all(env,'SELECT source,count(*) AS count FROM requests GROUP BY source')});
 }
 if(path==='/api/contacts'&&method==='GET'){
  requireRole(user,roles.crm);const page=Math.max(1,Number(url.searchParams.get('page'))||1),search=(url.searchParams.get('q')||'').slice(0,100);const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
  return json({items:await all(env,"SELECT * FROM contacts WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 50 OFFSET ?",pattern,pattern,pattern,(page-1)*50),page});
 }
 if(path==='/api/projects'&&method==='GET')return json({items:user.role==='client'?await all(env,'SELECT id,title,status,due_date,description,created_at FROM projects WHERE client_id=? ORDER BY created_at DESC',user.id):await all(env,'SELECT p.*,u.name AS client_name FROM projects p LEFT JOIN users u ON p.client_id=u.id ORDER BY p.created_at DESC LIMIT 500')});
 if(path==='/api/projects'&&method==='POST'){
  requireRole(user,roles.work);const b=await body(req);const client=text(b,'client_id',36)||null,request=text(b,'request_id',36)||null;await reference(env,'users',client,'client');await reference(env,'requests',request);const key=id();
  await env.DB.batch([sql(env,'INSERT INTO projects(id,title,client_id,request_id,status,due_date,description) VALUES (?,?,?,?,?,?,?)',key,text(b,'title',200,true),client,request,choice(b,'status',projectStages,'Planning'),date(b),text(b,'description',3000)),audit(env,user,'project.created',key)]);return json({id:key},201);
 }
 const projectMatch=path.match(/^\/api\/projects\/([a-f0-9-]{36})$/);
 if(projectMatch&&method==='PATCH'){requireRole(user,roles.work);await existing(env,'projects',projectMatch[1]);const b=await body(req);await env.DB.batch([sql(env,'UPDATE projects SET status=? WHERE id=?',choice(b,'status',projectStages),projectMatch[1]),audit(env,user,'project.status_changed',projectMatch[1])]);return json({ok:true});}
 if(path==='/api/tasks'&&method==='GET'){requireRole(user,staffRoles);return json({items:await all(env,'SELECT t.*,u.name AS assignee_name,p.title AS project_title FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id LEFT JOIN projects p ON p.id=t.project_id ORDER BY t.created_at DESC LIMIT 500')});}
 if(path==='/api/tasks'&&method==='POST'){
  requireRole(user,roles.work);const b=await body(req);const assignee=text(b,'assignee_id',36)||null,project=text(b,'project_id',36)||null;await reference(env,'users',assignee,'staff');await reference(env,'projects',project);const key=id();
  await env.DB.batch([sql(env,'INSERT INTO tasks(id,title,project_id,assignee_id,priority,due_date) VALUES (?,?,?,?,?,?)',key,text(b,'title',200,true),project,assignee,choice(b,'priority',['Low','Medium','High'],'Medium'),date(b)),audit(env,user,'task.created',key)]);return json({id:key},201);
 }
 const taskMatch=path.match(/^\/api\/tasks\/([a-f0-9-]{36})$/);
 if(taskMatch&&method==='PATCH'){requireRole(user,roles.work);await existing(env,'tasks',taskMatch[1]);const b=await body(req);await env.DB.batch([sql(env,'UPDATE tasks SET status=? WHERE id=?',choice(b,'status',taskStages),taskMatch[1]),audit(env,user,'task.status_changed',taskMatch[1])]);return json({ok:true});}
 if(path==='/api/users'&&method==='GET'){requireRole(user,staffRoles);return json({items:await all(env,'SELECT id,name,email,phone,company,role,active,email_verified,created_at FROM users ORDER BY created_at DESC LIMIT 500')});}
 if(path==='/api/users'&&method==='POST'){
  requireRole(user,['owner']);const b=await body(req),key=id();const hash=await hashPassword(password(b));const address=email(b);if(await sql(env,'SELECT id FROM users WHERE email=?',address).first())throw new HttpError(409,'Account already exists.');
  await env.DB.batch([sql(env,'INSERT INTO users(id,name,email,password_hash,role) VALUES (?,?,?,?,?)',key,text(b,'name',150,true),address,hash,choice(b,'role',['admin','sales','manager'])),audit(env,user,'staff.created',key)]);return json({id:key},201);
 }
 const userMatch=path.match(/^\/api\/users\/([a-f0-9-]{36})$/);
 if(userMatch&&method==='PATCH'){
  requireRole(user,['owner']);const target=await existing(env,'users',userMatch[1]);if(target.role==='owner'||target.id===user.id)throw new HttpError(403,'Owner accounts cannot be modified here.');const b=await body(req);if(typeof b.active!=='boolean')throw new HttpError(400,'active must be a boolean.');
  await env.DB.batch([sql(env,'UPDATE users SET active=? WHERE id=?',b.active?1:0,target.id),sql(env,'DELETE FROM sessions WHERE user_id=?',target.id),audit(env,user,b.active?'account.enabled':'account.disabled',target.id)]);return json({ok:true});
 }
 if(path==='/api/audit'&&method==='GET'){requireRole(user,['owner','admin']);return json({items:await all(env,'SELECT a.*,u.name AS actor FROM audit a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200')});}
 throw new HttpError(404,'Not found.');
}
function headers(response,isPortal){const h=new Headers(response.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','strict-origin-when-cross-origin');h.set('X-Frame-Options','DENY');h.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');h.set('Strict-Transport-Security','max-age=31536000');h.set('Content-Security-Policy',`default-src 'self'; script-src 'self' ${isPortal?'':"'unsafe-inline'"} https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'`);return new Response(response.body,{status:response.status,headers:h});}
export default {
 async fetch(req,env){const url=new URL(req.url);if(url.protocol!=='https:'&&!localMode(env,req)){url.protocol='https:';return Response.redirect(url.href,308);}try{
  if(url.pathname.startsWith('/api/'))return headers(await api(req,env,url),true);
  if(url.pathname==='/admin'||url.pathname.startsWith('/admin/')){const user=await getUser(req,env);if(!user)return Response.redirect(url.origin+'/portal/',302);requireRole(user,staffRoles);return Response.redirect(url.origin+'/portal/#overview',302);}
  return headers(await env.ASSETS.fetch(req),url.pathname.startsWith('/portal/'));
 }catch(error){return headers(json({error:error instanceof HttpError?error.message:'Service unavailable. Please try again later.'},error instanceof HttpError?error.status:503),true);}},
 async scheduled(event,env){await env.DB.batch([sql(env,"DELETE FROM events WHERE created_at<datetime('now','-90 days')"),sql(env,'DELETE FROM sessions WHERE expires_at<?',Math.floor(Date.now()/1000)),sql(env,'DELETE FROM rate_limits WHERE expires_at<?',Math.floor(Date.now()/1000))]);}
};
