const MARKDOWN_SPECIAL = /[_*[\]()~`>#+\-=|{}.!]/g;

export function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIAL, "\\$&");
}

const MAX_CHUNK_LENGTH = 4000;

interface DigestArticle {
  title: string;
  url: string;
  source: string;
  author?: string | null;
}

export function formatDigestMessage(articles: DigestArticle[]): string[] {
  if (articles.length === 0) return [];

  const header = "📬 *Daily Dev Digest*\n\n";

  const entries = articles.map((a, i) => {
    const title = escapeMarkdown(a.title);
    const source = escapeMarkdown(a.source);
    const author = a.author ? ` | ✍️ ${escapeMarkdown(a.author)}` : "";
    return `${i + 1}\\. [${title}](${a.url})\n   🏷️ ${source}${author}`;
  });

  const chunks: string[] = [];
  let current = header;

  for (const entry of entries) {
    const line = entry + "\n";
    if (current.length + line.length > MAX_CHUNK_LENGTH) {
      chunks.push(current.trimEnd());
      current = header;
    }
    current += line;
  }

  if (current !== header) {
    chunks.push(current.trimEnd());
  }

  const total = chunks.length;
  if (total > 1) {
    return chunks.map((chunk, i) => {
      const partLabel = `(Part ${i + 1}/${total})`;
      const firstNewline = chunk.indexOf("\n\n");
      if (firstNewline !== -1) {
        return (
          chunk.slice(0, firstNewline) +
          ` ${partLabel}` +
          chunk.slice(firstNewline)
        );
      }
      return chunk + ` ${partLabel}`;
    });
  }

  return chunks;
}
