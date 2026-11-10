import { quizValue } from '../../src/server/learning-quiz.ts';
export function correctLearningOption(question: any, detail: any) {
  const values = question.kind === 'name' ? [detail.node.name]
    : question.kind === 'description' ? [detail.node.description]
    : question.kind === 'property' ? detail.attributes.filter((item: any) => String(item.property || item.key) === question.property).map((item: any) => quizValue(item.value))
    : detail.related.map((item: any) => item.node.name);
  return question.options.find((option: any) => values.includes(option.text))?.id;
}
