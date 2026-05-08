import fs from 'node:fs';
import path from 'node:path';

function readReactStyleSource(root) {
  const entry = fs.readFileSync(path.join(root, 'src', 'react', 'styles.css'), 'utf8');
  const styleDir = path.join(root, 'src', 'react', 'styles');
  const modules = fs.readdirSync(styleDir)
    .filter(file => file.endsWith('.css'))
    .sort()
    .map(file => fs.readFileSync(path.join(styleDir, file), 'utf8'))
    .join('\n');
  return `${entry}\n${modules}`;
}

export { readReactStyleSource };
