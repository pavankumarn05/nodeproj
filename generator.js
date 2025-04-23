const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function generateTestBlock(functionName, fileName) {
  return `
const { ${functionName} } = require('./${fileName}');

describe('${functionName}', () => {
  it('should work as expected', () => {
    const a = 1; // TODO: Input
    const b = 2; // TODO: Input
    const result = ${functionName}(a, b);
    expect(result).toBe(/* expected result */);
  });
});
`.trim();
}

async function generateTests(inputFilePath) {
  const code = fs.readFileSync(inputFilePath, 'utf-8');
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });

  const testBlocks = new Set();
  const fileName = path.basename(inputFilePath, '.js');

  traverse(ast, {
    FunctionDeclaration(path) {
      testBlocks.add(generateTestBlock(path.node.id.name, fileName));
    },
    VariableDeclarator(path) {
      if (
        path.node.init &&
        (path.node.init.type === 'ArrowFunctionExpression' || path.node.init.type === 'FunctionExpression')
      ) {
        testBlocks.add(generateTestBlock(path.node.id.name, fileName));
      }
    },
    AssignmentExpression(path) {
      // Handles: module.exports.add = ... or exports.add = ...
      const left = path.node.left;
      if (
        left.type === 'MemberExpression' &&
        (left.object.name === 'module' || left.object.name === 'exports') &&
        left.property.type === 'Identifier'
      ) {
        testBlocks.add(generateTestBlock(left.property.name, fileName));
      }
    }
  });

  if (testBlocks.size === 0) {
    console.log('❌ No supported function definitions found to generate tests.');
    return;
  }

  const testContent = [...testBlocks].join('\n\n');
  const outputFilePath = inputFilePath.replace(/\.js$/, '.test.js');

  fs.writeFileSync(outputFilePath, testContent, 'utf-8');
  console.log(`✅ Test file generated at ${outputFilePath}`);
}

// Run from CLI
const inputFilePath = process.argv[2];
if (!inputFilePath) {
  console.error('❌ Usage: node generator.js myfile.js');
  process.exit(1);
}

generateTests(inputFilePath).catch((err) => {
  console.error('❌ Error generating tests:', err);
});
