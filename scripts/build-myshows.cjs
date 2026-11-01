const fs = require('node:fs/promises');
const path = require('node:path');
const {minify} = require('terser');

async function main() {
    const root = path.join(__dirname, '..');
    const source = await fs.readFile(path.join(root, 'myshows.full.js'), 'utf8');
    // Lite strips comments only; keep logging calls and argument side effects.
    const variants = [
        ['myshows.lite.js', {compress: false, mangle: false, format: {beautify: true, comments: false}}],
        ['myshows.js', {compress: true, mangle: true, format: {comments: false}}]
    ];
    for (const [filename, options] of variants) {
        const output = (await minify(source, {ecma: 5, ...options})).code + '\n';
        const file = path.join(root, filename);
        if (process.argv.includes('--check')) {
            if (await fs.readFile(file, 'utf8') !== output) throw new Error(filename + ' is stale; run npm run build:myshows');
        } else await fs.writeFile(file, output);
    }
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
