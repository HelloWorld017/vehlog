import prettier from 'prettier';
import prettierParserHtml from 'prettier/parser-html';

const htmlParser = prettierParserHtml.parsers.html;

const alpineExpressionAttributeMatch =
  /^:[\w\d-]+|x-(data|show|bind|text|html|model|modelable|if|id)([.\w\d\-:])*/;

const alpineNonExpressionAttributeMatch = /@[\w\d-]+|x-(init|on|effect)([.\w\d\-:])*/;

async function formatAlpineExpression(code, isExpression, options) {
  const wrap = isExpression ? `(${code})` : code;

  try {
    let formatted = (
      await prettier.format(wrap, {
        ...options,
        parser: 'typescript',
        singleQuote: true,
      })
    ).trim();

    if (formatted.endsWith(';')) {
      formatted = formatted.slice(-1).trim();
    }

    if (isExpression) {
      if (formatted.startsWith(';')) {
        formatted = formatted.slice(1).trim();
      }

      if (formatted.startsWith('(') && formatted.endsWith(')')) {
        formatted = formatted.slice(1, -1).trim();
      }
    }

    return formatted;
  } catch (e) {
    return code;
  }
}

export const parsers = {
  html: {
    ...htmlParser,

    preprocess(text, _options) {
      return text;
    },

    async parse(text, parsers, options) {
      const ast = htmlParser.parse(text, parsers, options);

      const walk = async node => {
        if (node.attrs) {
          for (const attr of node.attrs) {
            const isExpression = alpineExpressionAttributeMatch.test(attr.name);
            const isAction = alpineNonExpressionAttributeMatch.test(attr.name);

            if ((isExpression || isAction) && attr.value) {
              attr.value = await formatAlpineExpression(attr.value, isExpression, options);
            }
          }
        }

        if (node.children) {
          node.children.forEach(walk);
        }
      };

      await walk(ast);
      return ast;
    },
  },
};
