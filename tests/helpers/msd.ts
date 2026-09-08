export interface MSDTag {
  tag: string;
  params: string[];
}

export function parseMSD(content: string): MSDTag[] {
  const tags: MSDTag[] = [];
  let inTag = false;
  let inComment = false;
  let currentTag = '';
  let currentParams: string[] = [];
  let currentVal = '';
  let escapeNext = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const nextCh = i + 1 < content.length ? content[i + 1] : '';

    if (inComment) {
      if (ch === '\n' || ch === '\r') {
        inComment = false;
      }
      continue;
    }

    if (ch === '/' && nextCh === '/' && !escapeNext) {
      inComment = true;
      i++;
      continue;
    }

    if (escapeNext) {
      currentVal += ch;
      escapeNext = false;
      continue;
    }

    if (ch === '\\') {
      escapeNext = true;
      continue;
    }

    if (!inTag) {
      if (ch === '#') {
        inTag = true;
        currentTag = '';
        currentParams = [];
        currentVal = '';
      }
    } else {
      if (ch === ':') {
        if (!currentTag) {
          currentTag = currentVal.trim().toUpperCase();
        } else {
          currentParams.push(currentVal);
        }
        currentVal = '';
      } else if (ch === ';') {
        if (!currentTag) {
          currentTag = currentVal.trim().toUpperCase();
        } else {
          currentParams.push(currentVal);
        }
        tags.push({ tag: currentTag, params: currentParams });
        inTag = false;
        currentTag = '';
        currentParams = [];
        currentVal = '';
      } else if (ch === '#' && (content[i - 1] === '\n' || content[i - 1] === '\r')) {
        // Recovery rule: unescaped # on newline implicitly closes previous tag
        if (currentTag) {
          currentParams.push(currentVal);
          tags.push({ tag: currentTag, params: currentParams });
        }
        currentTag = '';
        currentParams = [];
        currentVal = '';
      } else {
        currentVal += ch;
      }
    }
  }

  if (inTag && currentTag) {
    currentParams.push(currentVal);
    tags.push({ tag: currentTag, params: currentParams });
  }

  return tags;
}

export function getSmallestNoteTypeForMeasure(nonEmptyTicks: number[]): number {
  if (nonEmptyTicks.length === 0) return 4;
  const strides = [48, 24, 16, 12, 8, 6, 4, 3, 2, 1];
  for (const stride of strides) {
    const fits = nonEmptyTicks.every(tick => tick % stride === 0);
    if (fits) {
      return 192 / stride;
    }
  }
  return 192;
}
