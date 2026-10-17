/** Display only: preserve stored replies, user text, code and quoted evidence. */
export function formatAvatarReply(content: string): string {
  const protectedParts = /(```[\s\S]*?(?:```|(?![\s\S]))|~~~[\s\S]*?(?:~~~|(?![\s\S]))|`[^`\n]+`|「[^」]*」|“[^”]*”|"[^"\n]*"|^[ \t]*>[^\n]*)/gm;
  return content.split(protectedParts).map((part, index) => {
    if (index % 2) return part;
    return part
      .replace(/^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/gm, '$1')
      .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, '$1')
      .replace(/^ {0,3}(?:\*[ \t]*){3,}$/gm, '')
      .replace(/^ {0,3}(?:-[ \t]*){3,}$/gm, '');
  }).join('');
}
