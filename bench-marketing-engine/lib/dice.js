import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
const ENDPOINT='https://mcp.dice.com/mcp';
async function runDice(fn){
 const client=new Client({name:'benchpilot-dice-discovery',version:'1.0.0'},{versionNegotiation:{mode:'legacy'}});
 try{
  const transport=new StreamableHTTPClientTransport(new URL(ENDPOINT));
  await client.connect(transport);
  return await fn(client);
 }finally{await client.close().catch(()=>{});}
}
export async function inspectDice(){
 return runDice(async c=>{
   const response=await c.listTools();
   return (response.tools||[]).map(t=>({name:t.name,description:String(t.description||'').slice(0,180),schema:t.inputSchema}));
 });
}
export async function queryDice(search){
 return runDice(async c=>c.callTool({name:'search_jobs',arguments:search}));
}
