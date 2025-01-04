import fs from 'node:fs';
import assert from 'node:assert';
import crypto from 'node:crypto';
import mkdirx from '../index.js';

describe('testing mkdirx.link()', () => {
  const baseDir = `.tmp-${crypto.randomBytes(8).toString('hex')}`;
  it('create a simple hardlink', async () => {
    await mkdirx(baseDir, {
      'target.txt': mkdirx.file(),
      'link.txt': mkdirx.link('target.txt'),
    });

    const linkStat = fs.statSync(`${baseDir}/link.txt`);
    assert(linkStat.isFile() && linkStat.nlink === 2);
  });

  it(`create hardlink in nested directories`, async () => {
    await mkdirx(baseDir, {
      '1/a/from.txt': mkdirx.file(),
      '2/a/link.txt': mkdirx.link('../../1/a/from.txt'),
    });

    const linkStat = fs.statSync(`${baseDir}/2/a/link.txt`);
    assert(linkStat.isFile() && linkStat.nlink === 2);
  });


  afterEach(() => fs.rmSync(baseDir, { recursive: true }));
});
