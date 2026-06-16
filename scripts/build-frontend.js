const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'frontend-gas');
const outputDir = path.join(root, 'public');
const indexPath = path.join(sourceDir, 'index.html');

const includePattern = /<\?!=\s*include\('([^']+)'\);\s*\?>/g;

const readInclude = (name) => {
  const filePath = path.join(sourceDir, `${name}.html`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el include frontend-gas/${name}.html`);
  }
  return fs.readFileSync(filePath, 'utf8');
};

const build = () => {
  const template = fs.readFileSync(indexPath, 'utf8');
  const html = template
    .replace(includePattern, (_, name) => readInclude(name))
    .replace(/<base target="_top">\s*/g, '');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
  fs.writeFileSync(
    path.join(outputDir, 'robots.txt'),
    'User-agent: *\nAllow: /\n',
    'utf8',
  );
};

build();
