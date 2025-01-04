import fs from 'node:fs';
import assert from 'node:assert';
import crypto from 'node:crypto';
import mkdirx from '../index.js';

describe('testing mkdirx.dir()', () => {
  const baseDir = `.tmp-${crypto.randomBytes(8).toString('hex')}`;

  it('create an empty directory', async () => {
    await mkdirx(baseDir, { dir: mkdirx.dir() });
    assert(fs.statSync(`${baseDir}/dir`).isDirectory());
    assert(fs.readdirSync(`${baseDir}/dir`).length === 0);
  });

  it('creates a directory that contains files', async () => {
    const fileNames = ['file1.txt', 'file2.txt'];
    await mkdirx(baseDir, {
      dir: mkdirx.dir({ [fileNames[0]]: mkdirx.file() })
        .$expand({ [fileNames[1]]: mkdirx.file() }),
    });

    const dirEntries = fs.readdirSync(`${baseDir}/dir`);
    assert(dirEntries.length === fileNames.length);
    assert(dirEntries.every((v) => fileNames.includes(v)));
  });

  afterEach(() => fs.rmSync(baseDir, { recursive: true }));
});
