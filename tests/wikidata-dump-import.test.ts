import { test, expect } from 'bun:test';
import { convertWikidata, readDefaultImportSchema, wikidataTypes, mergeWikidataTypes, mergeWikidataOntologies, removeWikidataRoots } from '../scripts/import-wikidata-dump';
import { documentKey } from '../src/server/arangodb';
test('Wikidata items retain languages, claims and stable graph identifiers', () => {
  const result=convertWikidata({id:'Q42',type:'item',labels:{en:{language:'en',value:'Douglas Adams'}},claims:{P31:[{id:'Q42$abc',type:'statement',rank:'normal',mainsnak:{property:'P31',snaktype:'value',datatype:'wikibase-item',datavalue:{type:'wikibase-entityid',value:{id:'Q5','entity-type':'item','numeric-id':5}}}}]}},7)!;
  expect(result.entity._key).toBe(documentKey('wikidata:Q42'));
  expect(result.entity.labels.en.value).toBe('Douglas Adams');
  expect(result.entity.project_id).toBe(7);
  expect(result.entity.class_ids).toEqual(['class/wikidata/Q5']);
  expect(result.edges[0]._to).toBe('entity/'+documentKey('wikidata:Q5'));
  expect(result.edges[0].property_id).toBe('P31');
  expect(convertWikidata({id:'P31',type:'property'},7)).toBeNull();
});

test('missing Arango schema migrates all existing project-scoped definitions', () => {
  const calls:any[]=[];
  const database={query:(sql:string)=>({all:(id:number)=>{calls.push([sql,id]);return [{id:'existing:'+calls.length}];}})};
  const schema=readDefaultImportSchema(database,7);
  expect(schema.classes[0].id).toBe('existing:1');
  expect(schema.ontologies[0].id).toBe('existing:2');
  expect(schema.properties[0].id).toBe('existing:3');
  expect(schema.ontology_properties[0].id).toBe('existing:4');
  expect(calls.every(([sql,id])=>sql.includes('project_id=?') && id===7)).toBe(true);
});

test('imports only Chinese and English localized fields',()=>{
 const labels={zh:{language:'zh',value:'Chinese'},'zh-hant':{language:'zh-hant',value:'Traditional'},en:{language:'en',value:'English'},fr:{language:'fr',value:'French'}};
 const result=convertWikidata({id:'Q1',type:'item',labels,descriptions:labels,aliases:{en:[labels.en],fr:[labels.fr]},sitelinks:{zhwiki:{title:'z'},enwiki:{title:'e'},frwiki:{title:'f'}}},7)!;
 expect(Object.keys(result.entity.labels)).toEqual(['zh','zh-hant','en']);
 expect(Object.keys(result.entity.descriptions)).toEqual(['zh','zh-hant','en']);
 expect(Object.keys(result.entity.aliases)).toEqual(['en']);
 expect(Object.keys(result.entity.data.sitelinks)).toEqual(['zhwiki','enwiki']);
});

test('type extraction excludes deprecated claims and builds named acyclic hierarchy',()=>{
 const claim=(id:string,rank='normal')=>({rank,mainsnak:{snaktype:'value',datavalue:{value:{id}}}});
 expect(wikidataTypes({claims:{P31:[claim('Q5'),claim('Q5'),claim('Q9','deprecated')]}},'P31')).toEqual(['Q5']);
 const classes=mergeWikidataTypes([],['Q5'],[
  {data:{wikidata_id:'Q5',wikidata_parent_ids:['Q6','Q7']},labels:{en:{value:'Human'}}},
  {data:{wikidata_id:'Q6',wikidata_parent_ids:['Q5']},labels:{zh:{value:'Parent'}}},
 ],7);
 expect(classes.find(row=>row.wikidata_id==='Q5').name).toBe('Human');
 expect(classes.find(row=>row.wikidata_id==='Q5').parent_id).toBe('class/wikidata/Q6');
 expect(classes.find(row=>row.wikidata_id==='Q6').parent_id).toBeNull();
 expect(classes.find(row=>row.wikidata_id==='Q7').name).toBe('Q7');
});

test('ontology extraction is separate from categories and links observed properties',()=>{
 const record={id:'Q42',type:'item',claims:{P31:[{mainsnak:{property:'P31',snaktype:'value',datatype:'wikibase-item',datavalue:{value:{id:'Q5'}}}}]}};
 const converted=convertWikidata(record,7)!;
 expect(converted.entity.type).toBe('ontology/wikidata/Q5');
 expect(converted.entity.data.wikidata_ontology_ids).toEqual(['ontology/wikidata/Q5']);
 const schema:any={classes:mergeWikidataTypes([],['Q5'],[{data:{wikidata_id:'Q5',wikidata_parent_ids:[]},labels:{en:{value:'Human'}}}],7),ontologies:[],properties:[],ontology_properties:[]};
 mergeWikidataOntologies(schema,[converted.entity],converted.edges,7);
 expect(schema.ontologies.find((row:any)=>row.id==='ontology/wikidata/Q5').name).toBe('Human');
 expect(schema.properties.find((row:any)=>row.id==='P31').datatype).toBe('wikibase-item');
 expect(schema.ontology_properties).toContainEqual({ontology_id:'ontology/wikidata/Q5',property_id:'P31'});
 mergeWikidataOntologies(schema,[converted.entity],converted.edges,7);
 expect(schema.ontology_properties.length).toBe(1);
});

test('artificial roots are removed without deleting real types',()=>{
 const schema=removeWikidataRoots({classes:[{id:'class/wikidata-import'},{id:'class/wikidata/Q5',parent_id:'class/wikidata-import'}],ontologies:[{id:'ontology/wikidata-import'},{id:'ontology/wikidata/Q5',parent_id:'ontology/wikidata-import'}],ontology_properties:[]});
 expect(schema.classes).toEqual([{id:'class/wikidata/Q5',parent_id:null}]);
 expect(schema.ontologies).toEqual([{id:'ontology/wikidata/Q5',parent_id:null}]);
 const item=convertWikidata({id:'Q1',type:'item'},7)!;
 expect(item.entity.class_ids).toEqual([]);expect(item.entity.type).toBe('');
});
