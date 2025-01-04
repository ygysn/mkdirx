import fs from 'node:fs';
import assert from 'node:assert';
import crypto from 'node:crypto';
import mkdirx from '../index.js';

describe('testing mkdirx.file()', () => {
  const baseDir = `.tmp-${crypto.randomBytes(8).toString('hex')}`;

  it('create an empty file', async () => {
    await mkdirx(baseDir, { 'file.txt': mkdirx.file() });
    assert(fs.statSync(`${baseDir}/file.txt`).isFile());
    assert(fs.readFileSync(`${baseDir}/file.txt`).length === 0);
  });

  it('create a file that has content', async () => {
    const contents = ['This is a test 1\n', 'This is a test 2\n', 'This is a test 3'];
    await mkdirx(baseDir, {
      'file.txt': mkdirx.file()
        .$write(contents[0])
        .$append(contents[1])
        .$append(contents[2]),
    });

    assert(fs.readFileSync(`${baseDir}/file.txt`).toString('utf-8') === contents.join(''));
  });

  it('create a file with file mode is o774', async () => {
    await mkdirx(baseDir, { 'file.txt': mkdirx.file().$mode(0o774) });
    assert((fs.statSync(`${baseDir}/file.txt`).mode & 0o777) === 0o774);
  });

  afterEach(() => fs.rmSync(baseDir, { recursive: true }));
});
