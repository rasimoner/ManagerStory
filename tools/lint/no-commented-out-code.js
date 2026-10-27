/* ESLint rule: a comment that is code is dead code (AGENTS.md, "Kod"). Git keeps the old version; a comment
   explains why. A comment counts as code when its text parses as JavaScript and is more than a lone word,
   number or name (prose, "TODO" or a file name do not parse, or are a lone name). */
import * as espree from 'espree';

const PARSE_OPTIONS = { ecmaVersion: 'latest', sourceType: 'module' };

function parses(text) {
  try {
    return espree.parse(text, PARSE_OPTIONS);
  } catch {
    return null;
  }
}

function isLoneValue(statement) {
  if (statement.type !== 'ExpressionStatement') return false;
  const { type } = statement.expression;
  return type === 'Identifier' || type === 'Literal' || type === 'MemberExpression' || type === 'TemplateLiteral';
}

function looksLikeCode(text) {
  const trimmed = text.trim();
  if (!trimmed || !/[;(){}=]/.test(trimmed)) return false;
  const program = parses(trimmed);
  if (!program || program.body.length === 0) return false;
  return !program.body.every(statement => isLoneValue(statement) || statement.type === 'EmptyStatement' || statement.type === 'LabeledStatement');
}

// consecutive line comments read as one block: `// if (x) {` / `//   go();` / `// }`
function commentGroups(comments) {
  const groups = [];
  for (const comment of comments) {
    if (comment.type === 'Shebang') continue;
    const last = groups.at(-1);
    const continues = last && comment.type === 'Line' && last.type === 'Line' && comment.loc.start.line === last.end.line + 1;
    if (continues) {
      last.text += `\n${comment.value}`;
      last.end = comment.loc.end;
    } else {
      groups.push({ type: comment.type, text: comment.value, start: comment.loc.start, end: comment.loc.end });
    }
  }
  return groups;
}

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow commented-out code' },
    schema: [],
    messages: { commentedOutCode: 'Commented-out code: delete it (git keeps the history).' },
  },
  create(context) {
    return {
      Program() {
        for (const group of commentGroups(context.sourceCode.getAllComments())) {
          const text = group.type === 'Block' ? group.text.replace(/^\s*\*/gm, '') : group.text;
          if (looksLikeCode(text)) context.report({ loc: { start: group.start, end: group.end }, messageId: 'commentedOutCode' });
        }
      },
    };
  },
};
