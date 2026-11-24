import { test, expect } from 'bun:test';
import { EnterpriseKnowledgeStore, arangoNodeResponse } from '../src/server/enterprise-knowledge';
test('image descriptions survive reorder and unrelated edits and are removed with images',()=>{
 const store=new EnterpriseKnowledgeStore({} as any),user={id:42,username:'owner'};
 const first=store.patch(null,{id:'image-test',images:['/a.jpg','/b.jpg'],image_metadata:[{url:'/a.jpg',description:'First'},{url:'/b.jpg',description:'Second'}]},7,user);
 expect(arangoNodeResponse(first,user).image_metadata).toHaveLength(2);
 const reordered=store.patch(first,{images:['/b.jpg','/a.jpg']},7,user);expect(reordered.image_metadata).toEqual(first.image_metadata);
 const edited=store.patch(reordered,{description:'Unrelated edit'},7,user);expect(edited.image_metadata).toEqual(first.image_metadata);
 const deleted=store.patch(first,{images:['/b.jpg']},7,user);expect(deleted.image_metadata).toEqual([{url:'/b.jpg',description:'Second'}]);
 const cleared=store.patch(first,{image_metadata:[{url:'/a.jpg',description:''}]},7,user);expect(cleared.image_metadata[0].description).toBe('');
 expect(()=>store.patch(first,{image_metadata:[{url:'/a.jpg',description:'a'.repeat(4001)}]},7,user)).toThrow();
});

test('image titles are independent of descriptions and survive edits',()=>{
 const store=new EnterpriseKnowledgeStore({} as any),user={id:42,username:'owner'};
 const node=store.patch(null,{id:'titled-image',images:['/a.jpg'],image_metadata:[{url:'/a.jpg',title:' Artwork ',description:' Caption '}]},7,user);
 expect(node.image_metadata).toEqual([{url:'/a.jpg',title:'Artwork',description:'Caption'}]);
 expect(arangoNodeResponse(store.patch(node,{name:'Updated'},7,user),user).image_metadata[0].title).toBe('Artwork');
 expect(()=>store.patch(node,{image_metadata:[{url:'/a.jpg',title:'x'.repeat(301),description:''}]},7,user)).toThrow();
});
