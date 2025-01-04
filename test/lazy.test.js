'use strict'

import fs from 'node:fs';
import assert from 'node:assert';
import crypto from 'node:crypto';
import mkdirx from '../index.js';

describe('testing mkdirx.lazy()', () => {
  const baseDir = `.tmp-${crypto.randomBytes(8).toString('hex')}`;

  it('create multiple regular files', async () => {
    await mkdirx(baseDir, {
      [mkdirx.paths('file1.txt', 'file2.txt')]: mkdirx.lazy((basePath, fileName) => {
        return mkdirx.file().$write(`Hello from ${fileName}!!`);
      }),
    });
    assert(fs.statSync(`${baseDir}/file1.txt`).isFile());
    assert(fs.readFileSync(`${baseDir}/file1.txt`).toString('utf-8') === 'Hello from file1.txt!!');
    assert(fs.statSync(`${baseDir}/file2.txt`).isFile());
    assert(fs.readFileSync(`${baseDir}/file2.txt`).toString('utf-8') === 'Hello from file2.txt!!');
  });

  afterEach(() => fs.rmSync(baseDir, { recursive: true }));
});
