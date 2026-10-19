/** Display memory statements in the owner’s first-person voice; leave source quotations untouched. */
export function selfMemoryVoice(text: string): string {
  return text.replace(
    /^用户(?=的|在|是|有|为|对|把|将|不|已|正|曾|会|能|想|要|希望|喜欢|偏好|倾向|重视|认为|选择|需要|习惯|决定|计划|通常|可能|更|往往)/u,
    '我',
  );
}
