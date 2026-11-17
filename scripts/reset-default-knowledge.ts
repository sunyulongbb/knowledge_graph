/** Explicitly clear only default application knowledge before a fresh dump import. */
import {ArangoClient,configFromEnvironment,ElasticsearchClient,elasticsearchEntityIndexName} from '../src/server/arangodb';
import {rename,stat} from 'node:fs/promises';
if(!process.argv.includes('--confirm-default'))throw Error('Requires --confirm-default; deletes default entity/link data.');
const config=configFromEnvironment();if(!config)throw Error('Missing ArangoDB configuration');
const client=new ArangoClient(config);
for(const name of ['entity','link']){
 const {body}=await client.database('default','/_api/collection/'+name+'/count');
 console.log(JSON.stringify({database:'default',collection:name,before:body.count}));
}
for(const name of ['link','entity'])await client.database('default','/_api/collection/'+name+'/truncate',{method:'PUT'});
if(process.env.ELASTICSEARCH_URL){
 const es=new ElasticsearchClient({url:process.env.ELASTICSEARCH_URL});
 try{await es.send('/'+elasticsearchEntityIndexName('default'),{method:'DELETE'});}catch(error:any){if(error.status!==404)throw error;}
}
const checkpoint='data/wikidata-import.checkpoint.json';
try{await stat(checkpoint);await rename(checkpoint,checkpoint+'.before-reset-'+Date.now());}catch(error:any){if(error.code!=='ENOENT')throw error;}
for(const name of ['entity','link']){
 const {body}=await client.database('default','/_api/collection/'+name+'/count');
 if(body.count!==0)throw Error('Default data is still being written by another process');
 console.log(JSON.stringify({database:'default',collection:name,after:body.count}));
}
console.log('Default knowledge cleared; application schema and accounts retained.');
