export interface ParsedBook {
  title: string;
  author: string;
  coverImage?: string;
  content: string; // HTML string
  toc: { id: string; title: string; level: number }[];
}

export async function parseTxt(file: File): Promise<ParsedBook> {
  const text = await file.text();

  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map((p, index) => `<p id="p-${index}">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const title = file.name.replace(/\.txt$/i, '');

  return {
    title,
    author: 'Unknown Author',
    content: `<div class="reader-content">${paragraphs}</div>`,
    toc: []
  };
}

export async function parseFb2(file: File): Promise<ParsedBook> {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");

  const titleInfo = xmlDoc.querySelector("title-info");
  const title = titleInfo?.querySelector("book-title")?.textContent || file.name.replace(/\.fb2$/i, '');

  const authorNode = titleInfo?.querySelector("author");
  const firstName = authorNode?.querySelector("first-name")?.textContent || "";
  const lastName = authorNode?.querySelector("last-name")?.textContent || "";
  const author = `${firstName} ${lastName}`.trim() || 'Unknown Author';

  let coverImage: string | undefined;
  const coverpageNode = titleInfo?.querySelector("coverpage image");
  if (coverpageNode) {
    const href = coverpageNode.getAttribute("l:href") || coverpageNode.getAttribute("href");
    if (href) {
      const id = href.replace(/^#/, '');
      const binaryNode = xmlDoc.querySelector(`binary[id="${id}"]`);
      if (binaryNode) {
        const contentType = binaryNode.getAttribute("content-type") || "image/jpeg";
        const base64 = binaryNode.textContent;
        if (base64) {
          coverImage = `data:${contentType};base64,${base64.trim()}`;
        }
      }
    }
  }

  const body = xmlDoc.querySelector("body");
  const sections = body ? Array.from(body.querySelectorAll("section")) : [];

  let contentHtml = '<div class="reader-content">';
  const toc: { id: string; title: string; level: number }[] = [];

  let pIndex = 0;

  function processNode(node: Element, level: number = 0) {
    if (node.tagName === "section") {

      const titleNode = Array.from(node.children).find(c => c.tagName === "title");

      let sectionTitle = "";
      if (titleNode) {
        sectionTitle = Array.from(titleNode.querySelectorAll("p"))
          .map(p => p.textContent)
          .join(" ")
          .trim();

        if (!sectionTitle) {
          sectionTitle = titleNode.textContent?.trim() || "";
        }
      }

      let firstParagraphId: string | null = null;

      // Заголовок БЕЗ id (важно)
      if (sectionTitle) {
        contentHtml += `<h${Math.min(level + 2, 6)}>${sectionTitle}</h${Math.min(level + 2, 6)}>`;
      }

      Array.from(node.children).forEach(child => {

        if (child.tagName === "title") return;

        if (child.tagName === "p") {
          const pid = `p-${pIndex++}`;

          // 🔥 фикс: первый абзац = якорь
          if (!firstParagraphId) {
            firstParagraphId = pid;
          }

          contentHtml += `<p id="${pid}">${child.innerHTML}</p>`;
        } 
        else if (child.tagName === "section") {
          processNode(child, level + 1);
        } 
        else {
          processContentNode(child);
        }

      });

      // 🔥 добавляем в TOC после обработки
      if (sectionTitle && firstParagraphId) {
        toc.push({
          id: firstParagraphId,
          title: sectionTitle,
          level
        });
      }

    } else {
      processContentNode(node);
    }
  }

  function processContentNode(node: Element) {
    if (node.tagName === "p") {
      contentHtml += `<p id="p-${pIndex++}">${node.innerHTML}</p>`;
    } else if (node.tagName === "empty-line") {
      contentHtml += `<br/>`;
    } else if (node.tagName === "image") {
      const href = node.getAttribute("l:href") || node.getAttribute("href");
      if (href) {
        const id = href.replace(/^#/, '');
        const binaryNode = xmlDoc.querySelector(`binary[id="${id}"]`);
        if (binaryNode) {
          const contentType = binaryNode.getAttribute("content-type") || "image/jpeg";
          const base64 = binaryNode.textContent;
          if (base64) {
            contentHtml += `<div class="my-4 flex justify-center">
              <img src="data:${contentType};base64,${base64.trim()}" class="max-w-full h-auto rounded-md" />
            </div>`;
          }
        }
      }
    } else if (node.tagName === "subtitle") {
      contentHtml += `<h4 class="text-lg font-semibold my-4 text-center">${node.textContent}</h4>`;
    } else if (node.tagName === "poem") {
      contentHtml += `<blockquote class="italic ml-8 border-l-4 border-primary pl-4 my-4">`;
      Array.from(node.children).forEach(child => {
        if (child.tagName === "stanza") {
          Array.from(child.children).forEach(v => {
            if (v.tagName === "v") {
               contentHtml += `<p id="p-${pIndex++}">${v.innerHTML}</p>`;
            }
          });
        }
      });
      contentHtml += `</blockquote>`;
    }
  }

  if (sections.length > 0) {
    sections.forEach(s => processNode(s, 0));
  } else if (body) {
    Array.from(body.children).forEach(child => processContentNode(child));
  }

  contentHtml += '</div>';

  return {
    title,
    author,
    coverImage,
    content: contentHtml,
    toc
  };
}