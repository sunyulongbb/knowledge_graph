import { expect, test } from 'bun:test';
import { buildLearningQuestions } from '../src/server/learning-quiz.ts';

test('questions use real facts and never contain duplicate answer choices',()=>{
  const node={id:'a',name:'月球',description:'地球的天然卫星'};
  const questions=buildLearningQuestions(node,[{property:'P1',property_label_zh:'类型',value:'天然卫星'}],
    [{node:{id:'b',name:'地球'},relation:'环绕'},{node:{id:'d',name:'太阳'},relation:'相关'}],
    [{id:'b',name:'地球',description:'行星'},{id:'d',name:'太阳',description:'恒星'},{id:'c',name:'火星',description:'行星'}]);
  expect(questions).toHaveLength(3);
  for(const question of questions){
    expect(new Set(question.options.map((option:any)=>option.text.toLowerCase())).size).toBe(question.options.length);
    expect(question.options.filter((option:any)=>option.id===question.correctOptionId)).toHaveLength(1);
  }
  const relation=questions.find(item=>item.kind==='relation')!;
  expect(relation.options.map((option:any)=>option.text)).not.toContain('太阳');
  expect(relation.explanation).toContain('环绕');
});
test('sparse knowledge produces a truthful name recognition question instead of invented facts',()=>{
  const questions=buildLearningQuestions({id:'a',name:'仅有名称'},[],[],[]);
  expect(questions).toHaveLength(1);expect(questions[0]!.kind).toBe('name');
  const answer=questions[0]!.options.find((item:any)=>item.id===questions[0]!.correctOptionId);
  expect(answer.text).toBe('仅有名称');
});

test('other true values of the same property are never used as wrong choices',()=>{
  const questions=buildLearningQuestions({id:'a',name:'示例'},[
    {property:'P1',value:'真实值一'},{property:'P1',value:'真实值二'},{property:'P2',value:'其他属性值'},
  ],[],[]);
  const question=questions.find(item=>item.kind==='property')!;
  expect(question.options.map((item:any)=>item.text)).not.toContain('真实值二');
  expect(question.options.map((item:any)=>item.text)).toContain('其他属性值');
});
