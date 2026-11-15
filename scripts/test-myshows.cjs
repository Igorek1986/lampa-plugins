const {spawnSync} = require('node:child_process');
const path = require('node:path');
for (const variant of ['myshows.full.js', 'myshows.lite.js', 'myshows.js']) {
    console.log('Testing ' + variant);
    const result = spawnSync(process.execPath, ['--test', 'tests/myshows-channel.test.cjs'], {
        cwd: path.join(__dirname, '..'), env: {...process.env, MYSHOWS_VARIANT: variant}, stdio: 'inherit'
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
