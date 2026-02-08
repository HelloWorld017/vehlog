import prettier from 'prettier';
import prettierParserHtml from 'prettier/parser-html';

const htmlParser = prettierParserHtml.parsers.html;

const alpineExpressionAttributeMatch =
  /^:[\w\d-]+|x-(data|show|bind|text|html|model|modelable|if|id)([.\w\d\-:])*/;

const alpineNonExpressionAttributeMatch = /@[\w\d-]+|x-(init|on|effect)([.\w\d\-:])*/;

async function formatAlpineExpression({ code, isExpression, options, attrName, baseIndentSize }) {
  const wrap = isExpression ? `(${code})` : code;

  try {
    let formatted = (
      await prettier.format(wrap, {
        ...options,
        parser: 'typescript',
        semi: true,
      })
    ).trim();

    if (isExpression) {
      formatted = formatted.replace(/^;/, ''); // ASI 방지용 세미콜론 제거
      if (formatted.startsWith('(') && formatted.endsWith(')')) {
        formatted = formatted.slice(1, -1).trim();
      }
    }

    if (formatted.endsWith(';')) {
      formatted = formatted.slice(0, -1).trim();
    }

    const collapsed = formatted.replace(/\n/g, ' ');
    const totalLength = baseIndentSize + attrName.length + 3 + collapsed.length;

    if (totalLength <= options.printWidth) {
      return collapsed;
    }

    const indentContent = ' '.repeat(baseIndentSize + options.tabWidth);
    return formatted
      .split('\n')
      .map((line, i) => (i === 0 || !line.trim() ? line : `${indentContent}${line}`))
      .join('\n');
  } catch (e) {
    return code;
  }
}

export const parsers = {
  html: {
    ...htmlParser,

    async parse(text, parsers, options) {
      const ast = await htmlParser.parse(text, parsers, options);

      const walk = async node => {
        if (node.attrs) {
          const baseIndentSize = node.sourceSpan?.start?.col ?? 0;

          for (const attr of node.attrs) {
            const isExpression = alpineExpressionAttributeMatch.test(attr.name);
            const isAction = alpineNonExpressionAttributeMatch.test(attr.name);

            if ((isExpression || isAction) && attr.value) {
              attr.value = await formatAlpineExpression({
                code: attr.value,
                isExpression,
                options,
                attrName: attr.name,
                baseIndentSize,
              });
            }
          }
        }

        if (node.children) {
          for (const child of node.children) {
            await walk(child);
          }
        }
      };

      await walk(ast);
      return ast;
    },
  },
};
