import * as fs from 'node:fs';
import * as path from 'node:path';

interface PackageJson { version: string }

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8')
) as PackageJson;
const outputPath = path.join(root, 'dist', 'copilotstatusline.js');
const output = fs.readFileSync(outputPath, 'utf8');
fs.writeFileSync(outputPath, output.replaceAll('__PACKAGE_VERSION__', packageJson.version), 'utf8');
