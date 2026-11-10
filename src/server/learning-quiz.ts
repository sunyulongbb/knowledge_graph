type Item = Record<string, any>;
export function quizValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}
export function buildLearningQuestions(node: Item, attributes: Item[], related: Item[], pool: Item[]) {
  const questions: Item[] = [];
  const name = String(node.name || node.label || '').trim();
  function add(kind: string, prompt: string, correct: string, wrong: string[], explanation: string, property?: string) {
    if (!correct || correct.length > 700) return;
    const seen = new Set([correct.toLocaleLowerCase()]);
    const distractors = wrong.map(value => value.trim()).filter(value => {
      const key = value.toLocaleLowerCase();
      if (!value || value.length > 700 || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 3);
    if (!distractors.length) return;
    const options = shuffle([correct, ...distractors]).map(text => ({ id: crypto.randomUUID(), text }));
    questions.push({ id: crypto.randomUUID(), kind, ...(property ? { property } : {}), prompt, options,
      correctOptionId: options.find(option => option.text === correct)!.id, explanation });
  }
  const description = String(node.description || node.desc_zh || '').trim();
  if (description) add('description', `哪段描述对应「${name}」？`, description,
    pool.map(item => String(item.description || item.desc_zh || '')), `知识描述：${description}`);
  const literal = attributes.filter(item => quizValue(item.value) && quizValue(item.value).length <= 250);
  const attribute = literal[0];
  if (attribute) {
    const value = quizValue(attribute.value), label = String(attribute.property_label_zh || attribute.property || attribute.key);
    const property = String(attribute.property || attribute.key);
    const trueValues = new Set(literal.filter(item => String(item.property || item.key) === property).map(item => quizValue(item.value).toLocaleLowerCase()));
    add('property', `以下哪一项是「${name}」的「${label}」值？`, value,
      [...literal.slice(1).map(item => quizValue(item.value)).filter(item => !trueValues.has(item.toLocaleLowerCase())), '资料未提供该属性值'], `属性依据：${label} = ${value}`, property);
  }
  const relation = related.find(item => item.node?.name && item.node.id !== node.id);
  if (relation) {
    const relatedIds = new Set(related.map(item => item.node.id));
    const relatedNames = new Set(related.map(item => String(item.node.name).toLocaleLowerCase()));
    add('relation', `以下哪条知识与「${name}」有直接关联？`, String(relation.node.name),
      pool.filter(item => item.id !== node.id && !relatedIds.has(item.id) && !relatedNames.has(String(item.name).toLocaleLowerCase())).map(item => String(item.name || '')),
      `图谱依据：${name} — ${relation.relation || '关联'} — ${relation.node.name}`);
  }
  // Sparse graphs still have a truthful recognition exercise, without invented facts.
  if (!questions.length) add('name', '当前学习关卡对应的知识名称是？', name,
    [...pool.filter(item => item.id !== node.id).map(item => String(item.name || '')), name === '资料未提供名称' ? '以上均不是' : '资料未提供名称'], `当前关卡的知识名称是「${name}」。`);
  return questions.slice(0, 3);
}
