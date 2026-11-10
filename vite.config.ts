import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export default defineConfig({ plugins: [react(), {
  name:'local-qa-artifacts',
  configureServer(server) { server.middlewares.use(async(req,res,next)=>{
    const match=req.url?.match(/^\/(?:PostFrame\/)?__qa\/([a-z-]+\.(?:json|png|jpg|mp4))$/);
    if(req.method!=='POST'||!match)return next();
    try {const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>150*1024*1024)throw new Error('Too large');chunks.push(chunk);}await mkdir('.qa',{recursive:true});await writeFile(resolve('.qa',match[1]),Buffer.concat(chunks));res.statusCode=204;res.end();}catch{res.statusCode=500;res.end('Could not save QA artifact');}
  }); }
}], base: '/PostFrame/', server: { watch: { ignored: ['**/.qa/**'] } }, worker: { format: 'es' }, build: { target: 'es2022' } });
