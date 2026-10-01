import {HttpError} from './security.mjs';
export async function body(req){
 if(!req.headers.get('Content-Type')?.includes('application/json'))throw new HttpError(415,'Expected JSON.');
 if(Number(req.headers.get('Content-Length'))>24000)throw new HttpError(413,'Request too large.');
 const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'Missing body.');let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>24000){await reader.cancel();throw new HttpError(413,'Request too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{const b=JSON.parse(new TextDecoder().decode(bytes));if(!b||Array.isArray(b)||typeof b!=='object')throw Error();return b;}catch{throw new HttpError(400,'Invalid JSON.');}
}
export function text(b,key,max=200,required=false){const v=b[key];if(v===undefined||v===null){if(required)throw new HttpError(400,`${key} is required.`);return '';}if(typeof v!=='string'||v.length>max||required&&!v.trim())throw new HttpError(400,`Invalid ${key}.`);return v.trim();}
export function email(b,required=true){const value=text(b,'email',254,required).toLowerCase();if(value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new HttpError(400,'Invalid email.');return value;}
export function password(b){const v=b.password;if(typeof v!=='string'||v.length<12||v.length>128)throw new HttpError(400,'Use a password between 12 and 128 characters.');return v;}
export function choice(b,key,options,fallback){const v=b[key]??fallback;if(!options.includes(v))throw new HttpError(400,`Invalid ${key}.`);return v;}
export function date(b,key='due_date'){const v=text(b,key,10);if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v))throw new HttpError(400,'Invalid date.');return v;}
export const leadStages=['New','Contacted','Qualified','Proposal','Won','Lost'];
export const projectStages=['Planning','Active','Review','Completed','On hold'];
export const taskStages=['Todo','In progress','Done'];
