export interface PdfSection {
  title: string;
  rows: Array<[string, string]>;
}

const sanitize = (value: unknown) =>
  String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapePdf = (value: string) => sanitize(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

const wrap = (text: string, max = 88) => {
  const words = sanitize(text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= max) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
};

const addText = (commands: string[], x: number, y: number, size: number, text: string, font = "F1") => {
  commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`);
};

export const createPdfBuffer = (title: string, sections: PdfSection[]) => {
  const pages: string[][] = [[]];
  let page = pages[0]!;
  let y = 770;

  const nextPage = () => {
    page = [];
    pages.push(page);
    y = 770;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 42) nextPage();
  };

  addText(page, 42, y, 18, title, "F2");
  y -= 20;
  addText(page, 42, y, 9, `Generated: ${new Date().toLocaleString("en-IN")}`);
  y -= 24;

  for (const section of sections) {
    ensureSpace(34);
    addText(page, 42, y, 13, section.title, "F2");
    y -= 15;
    for (const [label, value] of section.rows) {
      const lines = wrap(value, 76);
      ensureSpace(14 + lines.length * 11);
      addText(page, 54, y, 9, `${label}:`, "F2");
      y -= 11;
      for (const line of lines) {
        addText(page, 72, y, 9, line);
        y -= 11;
      }
      y -= 3;
    }
    y -= 10;
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const catalogId = addObject("<< /Type /Catalog /Pages 0 0 R >>");
  const pagesId = addObject("<< /Type /Pages /Kids [] /Count 0 >>");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (const commands of pages) {
    const stream = commands.join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    contentObjectIds.push(contentId);
    pageObjectIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
};
