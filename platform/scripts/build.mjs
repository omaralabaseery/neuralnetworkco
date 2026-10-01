import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
await cp('../index.html','dist/index.html');await cp('../public','dist/public',{recursive:true});await cp('../portal','dist/portal',{recursive:true});
console.log('Website and portal assets built.');
