import { escapeHtml } from './html.js';
import { icon } from './icons.js';
import { commandInputNames, resolveContentCommand, resolveContentLinkTarget } from '../../../../lib/workshop-resolver.mjs';

export function inlineMarkdown(value, profile) {
  const codeTokens = [];
  const linkTokens = [];
  let html = String(value).replace(/[\x60]([^\x60]+)[\x60]/g, (_, code) => {
    const token = '\u0000CODE' + codeTokens.length + '\u0000';
    codeTokens.push('<code>' + escapeHtml(code) + '</code>');
    return token;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (_, label, target) => {
    const url = resolveContentLinkTarget(target, profile);
    const token = '\u0000LINK' + linkTokens.length + '\u0000';
    const external = url && !url.startsWith('#');
    const profileLink = target.includes('{{') ? ' data-profile-link="' + escapeHtml(target) + '"' : '';
    linkTokens.push(url ? '<a href="' + escapeHtml(url) + '"' + profileLink + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + escapeHtml(label) + '</a>' : escapeHtml(label));
    return token;
  });
  html = escapeHtml(html);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/\u0000LINK(\d+)\u0000/g, (_, index) => linkTokens[Number(index)]);
  html = html.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => codeTokens[Number(index)]);
  return html;
}

export function indentOf(line) {
  return line.length - line.replace(/^ +/, '').length;
}

export function matchListItem(line) {
  const ordered = line.match(/^( *)(\d+)[.)]( +)(.*)$/);
  if (ordered) {
    return {
      type: 'ol',
      indent: ordered[1].length,
      number: Number(ordered[2]),
      contentIndent: ordered[1].length + ordered[2].length + 1 + ordered[3].length,
      text: ordered[4]
    };
  }
  const unordered = line.match(/^( *)[-*+]( +)(.*)$/);
  if (unordered) {
    return {
      type: 'ul',
      indent: unordered[1].length,
      number: 1,
      contentIndent: unordered[1].length + 1 + unordered[2].length,
      text: unordered[3]
    };
  }
  return null;
}

export function renderListItem(lines, profile, onCommand, commandShell) {
  const html = renderBlocks(lines, profile, onCommand, commandShell);
  const single = html.match(/^<p>([\s\S]*)<\/p>$/);
  if (single && single[1].indexOf('<p>') === -1) return '<li>' + single[1] + '</li>';
  return '<li>' + html + '</li>';
}

export function splitTableRow(line) {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const cells = [];
  let cell = '';
  let inCode = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\' && text[index + 1] === '|') {
      cell += '|';
      index += 1;
    } else if (char === '\x60') {
      inCode = !inCode;
      cell += char;
    } else if (char === '|' && !inCode) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function tableAlignments(line) {
  if (!/^ *\|?( *:?-+:? *\|)+( *:?-+:? *)?\|? *$/.test(line) || line.indexOf('|') === -1) return null;
  return splitTableRow(line).map((cell) => {
    if (/^:-+:$/.test(cell)) return 'center';
    if (/^-+:$/.test(cell)) return 'right';
    if (/^:-+$/.test(cell)) return 'left';
    return /^-+$/.test(cell) ? '' : null;
  });
}

export function isTableStart(lines, index) {
  if (index + 1 >= lines.length || lines[index].indexOf('|') === -1) return false;
  const alignments = tableAlignments(lines[index + 1]);
  return Boolean(alignments) && alignments.every((value) => value !== null) &&
    alignments.length === splitTableRow(lines[index]).length;
}

export function renderTableCell(tag, value, alignment, profile) {
  const className = alignment ? ' class="text-' + alignment + '"' : '';
  return '<' + tag + className + '>' + inlineMarkdown(value, profile) + '</' + tag + '>';
}

function fencedCode(source, info, profile, onCommand, commandShell) {
  const language = info.trim().split(/\s+/)[0].toLowerCase();
  const profileCommand = /^(sh|powershell) profile$/.test(info.trim());
  const commandTemplate = profileCommand ? source : null;
  if (profileCommand) source = resolveContentCommand(source, profile, {}, commandShell);
  const shell = /^(sh|bash|shell|powershell)$/.test(info.trim()) || profileCommand;
  const inputs = profileCommand ? commandInputNames(commandTemplate) : [];
  if (shell && source.trim()) onCommand?.(source, commandTemplate ?? source);
  let code = escapeHtml(source);
  if (language === 'json') {
    const parts = [];
    let end = 0;
    const tokens = /"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
    for (const match of source.matchAll(tokens)) {
      parts.push(escapeHtml(source.slice(end, match.index)));
      const token = match[0];
      const kind = token.startsWith('"') ?
        (/^\s*:/.test(source.slice(match.index + token.length)) ? 'key' : 'string') :
        (/^(true|false|null)$/.test(token) ? 'literal' : 'number');
      parts.push('<span class="syntax-' + kind + '">' + escapeHtml(token) + '</span>');
      end = match.index + token.length;
    }
    parts.push(escapeHtml(source.slice(end)));
    code = parts.join('');
  }
  const className = /^[a-z0-9_-]+$/.test(language) ? ' class="language-' + language + '"' : '';
  const block = '<pre class="markdown-code"><code' + className +
    (profileCommand ? ' data-profile-command="' + escapeHtml(commandTemplate) + '"' : '') +
    (shell ? ' data-command-template="' + escapeHtml(commandTemplate ?? source) + '"' : '') +
    '>' + code + '</code></pre>';
  const fieldLabels = {
    'report-id': 'Report ID',
    'download-url': 'Download URL',
    'output-file': 'Output file',
    'budget-id': 'Budget ID',
    'test-user': 'Test user',
  };
  const inputForm = inputs.length ? '<div class="terminal-inputs" role="group" aria-label="Command inputs">' +
    inputs.map((name) => {
      const label = fieldLabels[name] ?? name.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      const type = name.endsWith('-url') ? 'url' : 'text';
      return '<label class="terminal-input"><span>' + escapeHtml(label) + '</span><input type="' + type +
        '" data-command-input="' + escapeHtml(name) + '" maxlength="2000" autocomplete="off" required></label>';
    }).join('') + '</div>' : '';
  return shell && source.trim() ? '<div class="terminal-command">' + block +
    inputForm +
    '<button type="button" class="btn btn-sm terminal-launch" data-open-terminal title="Run the command above in a new terminal using the shell and credentials of this session">' + icon('terminal') + '<span>Open terminal and run</span></button></div>' : block;
}

function readFence(lines, start) {
  const fence = lines[start].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (!fence) return null;
  const code = [];
  let next = start + 1;
  while (next < lines.length) {
    const closing = lines[next].match(/^ {0,3}(`{3,}|~{3,})\s*$/);
    if (closing && closing[1][0] === fence[1][0] && closing[1].length >= fence[1].length) {
      next += 1;
      break;
    }
    code.push(lines[next++]);
  }
  return { source: code.join('\n'), info: fence[2].trim(), next };
}

// Block-level parser. Keeps wrapped lines inside their list item and keeps a
// list contiguous across blank lines, so ordered numbering never restarts.
export function renderBlocks(lines, profile, onCommand, commandShell = 'sh') {
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    let fence = readFence(lines, i);
    if (fence) {
      i = fence.next;
      if (/^(sh( profile)?|bash|shell)$/.test(fence.info)) {
        let next = i;
        while (next < lines.length && !lines[next].trim()) next += 1;
        const alternative = next < lines.length ? readFence(lines, next) : null;
        if (alternative?.info === (fence.info.endsWith(' profile') ? 'powershell profile' : 'powershell')) {
          i = alternative.next;
          if (commandShell === 'powershell') fence = alternative;
        }
      }
      output.push(fencedCode(fence.source, fence.info, profile, onCommand, commandShell));
      continue;
    }
    if (/^\*\*\*\s*$/.test(line)) { output.push('<hr>'); i += 1; continue; }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const id = heading[2].toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s/g, '-');
      output.push('<h' + level + ' id="' + escapeHtml(id) + '">' + inlineMarkdown(heading[2]) + '</h' + level + '>');
      i += 1;
      continue;
    }

    if (/^ *>/.test(line)) {
      const quoted = [];
      while (i < lines.length && /^ *>/.test(lines[i])) {
        quoted.push(lines[i].replace(/^ *> ?/, ''));
        i += 1;
      }
      const alert = quoted[0].trim().match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/);
      if (alert) {
        const type = alert[1].toLowerCase();
        const title = type[0].toUpperCase() + type.slice(1);
        output.push('<div class="markdown-alert markdown-alert-' + type + '" role="note">' +
          '<p class="markdown-alert-title">' + title + '</p>' +
          renderBlocks(quoted.slice(1), profile, onCommand, commandShell) + '</div>');
      } else {
        output.push('<blockquote>' + renderBlocks(quoted, profile, onCommand, commandShell) + '</blockquote>');
      }
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitTableRow(lines[i]);
      const alignments = tableAlignments(lines[i + 1]);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') !== -1) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      output.push('<div class="table-wrap"><table><thead><tr>' +
        header.map((cell, index) => renderTableCell('th', cell, alignments[index], profile)).join('') +
        '</tr></thead><tbody>' +
        rows.map((row) => '<tr>' + header.map((_, index) =>
          renderTableCell('td', row[index] || '', alignments[index], profile)
        ).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }

    const first = matchListItem(line);
    if (first) {
      const baseIndent = first.indent;
      const type = first.type;
      const start = first.number;
      const items = [];
      let current = null;
      let contentIndent = first.contentIndent;

      while (i < lines.length) {
        const candidate = lines[i];

        if (!candidate.trim()) {
          let lookahead = i + 1;
          while (lookahead < lines.length && !lines[lookahead].trim()) lookahead += 1;
          if (lookahead >= lines.length) break;
          const next = matchListItem(lines[lookahead]);
          const sameLevel = next && next.indent === baseIndent && next.type === type;
          const nested = indentOf(lines[lookahead]) > baseIndent;
          if (!sameLevel && !nested) break;
          if (current) current.push('');
          i = lookahead;
          continue;
        }

        const item = matchListItem(candidate);
        if (item && item.indent === baseIndent) {
          if (item.type !== type) break;
          contentIndent = item.contentIndent;
          current = [item.text];
          items.push(current);
          i += 1;
          continue;
        }

        if (!current) break;
        const indent = indentOf(candidate);
        // Indented block under the item, or a lazily wrapped continuation line.
        if (indent > baseIndent || !item) {
          current.push(candidate.slice(Math.min(indent, contentIndent)));
          i += 1;
          continue;
        }
        break;
      }

      const startAttr = type === 'ol' && start !== 1 ? ' start="' + start + '"' : '';
      output.push('<' + type + startAttr + '>' + items.map((item) => renderListItem(item, profile, onCommand, commandShell)).join('') + '</' + type + '>');
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,6}\s+/.test(lines[i]) && !/^ *>/.test(lines[i]) && !/^ {0,3}(`{3,}|~{3,})/.test(lines[i]) && !/^\*\*\*\s*$/.test(lines[i]) && !matchListItem(lines[i]) && !isTableStart(lines, i)) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    if (!paragraph.length) { i += 1; continue; }
    output.push('<p>' + inlineMarkdown(paragraph.join(' '), profile) + '</p>');
  }

  return output.join('');
}

export function renderMarkdown(markdown, profile, onCommand, commandShell = 'sh') {
  if (!markdown) return '';
  return renderBlocks(markdown.replace(/\t/g, '    ').split(/\r?\n/), profile, onCommand, commandShell);
}

export function renderQuestion(markdown, profile, commandShell = 'sh') {
  const rendered = renderMarkdown(markdown, profile, undefined, commandShell);
  const paragraph = rendered.match(/^<p>([\s\S]*)<\/p>$/);
  return paragraph ?
    { singleParagraph: true, html: paragraph[1] } :
    { singleParagraph: false, html: rendered };
}
