import { EnterpriseKnowledgeStore, localizedText } from '../src/server/enterprise-knowledge.ts';
const store = EnterpriseKnowledgeStore.configured();
const { body } = await store.client.system('/_api/database');
for (const db of body.result.filter((name: string) => name !== '_system')) {
  try {
    const schema = await store.importSchema(db);
    const entities = await store.query(db, 'FOR d IN entity FILTER STARTS_WITH(d.link || "", "https://www.wikidata.org/wiki/") RETURN {id:d.sqlite_id,name:d.labels, categories:d.class_ids, type:d.type, root:CONTAINS(d.wiki_md || "", "根据 [CC BY-SA 4.0]"),created:d.created_at}');
    console.log(JSON.stringify({db, ontologies:schema?.ontologies.length, categories:schema?.classes.length,roots:entities.filter(d=>d.root).map(d=>({id:d.id,name:localizedText(d.name)})),entityCount:entities.length}));
  } catch (error) { console.log(JSON.stringify({db,error:String(error)})); }
}
