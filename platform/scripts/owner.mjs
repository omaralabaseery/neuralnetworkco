// Generate a PRIVATE SQL seed using an environment variable. No public setup endpoint.
import {hashPassword} from '../src/security.mjs';import {writeFile} from 'node:fs/promises';
const email=process.env.OWNER_EMAIL?.trim().toLowerCase(),password=process.env.OWNER_PASSWORD,name=process.env.OWNER_NAME||'Company owner';
if(!email||!/^\S+@\S+\.\S+$/.test(email)||!password||password.length<16||password.length>128)throw new Error('Set OWNER_EMAIL and a unique OWNER_PASSWORD of 16–128 characters.');
const quote=x=>"'"+x.replaceAll("'","''")+"'";
await writeFile('owner-seed.sql',`INSERT INTO users(id,name,email,password_hash,role,email_verified) VALUES (${[crypto.randomUUID(),name,email,await hashPassword(password),'owner'].map(quote).join(',')},1);\n`,{mode:0o600});console.log('Private owner-seed.sql generated. Apply with Wrangler, then delete it.');
