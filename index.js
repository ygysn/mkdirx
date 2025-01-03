import pathutils from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

function mkdirWhenNotExists(path) {
  if (!fs.existsSync(path) && path !== '.') {
    return fsp.mkdir(path, { recursive: true });
  }
}

function isRegularObject(v) {
  return typeof v === 'object' && !Array.isArray(v) && v !== null;
}

function joinFilePath(basePath, filePath, forceRelative) {
  return pathutils.isAbsolute(filePath) && !forceRelative
  ? filePath
  : pathutils.join(basePath, filePath);
}

const pathsList = {};

/** Helper function to create a symbol that represents paths */
export function paths() {
  const args = Object.values(arguments);
  const pathsKey = Symbol(args.map(p => `"${p.replace('\\', '\\\\').replace('"', '\\"')}"`).join(' '));
  pathsList[pathsKey] = args;
  return pathsKey;
}

/** Directive to create a new directive */
function CustomDirective(func, props) {
  this.$action = 'custom';
  this.skipable = false;
  this.exec = func.bind(this);
  Object.assign(this, props);
}


/** Directive to create a new directive when creating a file or directory */
function LazyDirective(func) {
  this.$action = 'lazy';
  this.function = func;
}

LazyDirective.prototype.exec = async function(basePath, filePath) {
  (await this.function(basePath, filePath)).exec();
}

/** Directive to move a file or directory to a path inside the base directory */
function MoveDirective(target) {
  this.$action = 'move';
  this.skipable = false;
  this.target = target;
}

MoveDirective.prototype.exec = function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, true);
  return fsp.rename(this.target, path);
}

/** Directive to copy a file or directory to a path inside the base directory */
function CopyDirective(target) {
  this.$action = 'copy';
  this.skipable = false;
  this.target = target;
  this.dereferenceSymlink = false;
  this.filter = () => true;
  this.recursive = false;
  this.preserveTimestamps = false;
}

CopyDirective.prototype.$dereferenceSymlink = function(dereferenceSymlink) {
  this.dereferenceSymlink = dereferenceSymlink;
  return this;
}

CopyDirective.prototype.$filter = function(filter) {
  this.filter = filter;
  return this;
}

CopyDirective.prototype.$recursive = function(recursive) {
  this.recursive = recursive;
  return this;
}

CopyDirective.prototype.$preserveTimestamps = function(preserveTimestamps) {
  this.preserveTimestamps = preserveTimestamps;
}

CopyDirective.prototype.exec = function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, true);
  return fsp.cp(this.target, path, {
    dereference: this.dereferenceSymlink,
    filter: this.filter,
    force: this.force,
    recursive: this.recursive,
    preserveTimestamps: this.preserveTimestamps,
  });
}

/** Directive to create file, directory, symlink or hardlink inside the base directory */
function CreateDirective(type, permisions, owner) {
  this.$action = 'create';
  this.skipable = false;
  this.type = type;
  this.permisions = permisions;
  this.owner = owner;
}

CreateDirective.prototype.$permisions = function(permisions) {
  this.permisions = permisions;
  return this;
}

CreateDirective.prototype.$owner = function(uid, gid) {
  this.owner = { uid, gid };
  return this;
}

CreateDirective.prototype.applyFile = async function(file) {
  if (typeof this.owner?.uid === 'number' && typeof this.owner?.gid === 'number') {
    await file.chown(this.owner.uid, this.owner.gid);
  }

  if (typeof this.permisions === 'number') {
    await file.chmod(this.permisions);
  }
}

CreateDirective.prototype.applyPath = async function(path) {
  if (typeof this.owner?.uid === 'number' && typeof this.owner?.gid === 'number') {
    await fsp.chown(path, this.owner.uid, this.owner.gid);
  }

  if (typeof this.permisions === 'number') {
    await fsp.chmod(path, this.permisions);
  }
}

/** Directive to create file inside the base directory */
function FileDirective() {
  CreateDirective.call(this, 'file', 0o644, undefined);
  this.skipable = true;
  this.content = Buffer.alloc(0);
}

Object.setPrototypeOf(FileDirective.prototype, CreateDirective.prototype);
FileDirective.prototype.$write = function(data) {
  this.content = Buffer.from(data);
  return this;
}

FileDirective.prototype.$append = function(data) {
  const buff = Buffer.from(data);
  this.content = Buffer.concat([this.content, buff], this.content.length + buff.length);
  return this;
}

FileDirective.prototype.exec = async function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, true);
  await mkdirWhenNotExists(pathutils.dirname(path));
  const file = await fsp.open(path, 'w')
  await file.write(this.content);
  await this.applyFile(file);
  await file.close();
}

/** Directive to create directory inside the base directory */
function DirectoryDirective(files) {
  CreateDirective.call(this, 'directory', undefined, undefined);
  this.skipable = false;
  this.files = files ?? {};
}

DirectoryDirective.prototype.$files = function(files) {
  this.files = Object.assign({}, this.files, files);
  return this;
}

DirectoryDirective.prototype.exec = async function(basePath, dirPath, options) {
  const path = joinFilePath(basePath, dirPath, true);
  await mkdirWhenNotExists(path);
  await mkdirx(path, this.files, Object.assign(options, {
    force: true,
  }));
}

/** Directive to create symlink inside the base directory */
function SymlinkDirective(target, symlinkType = 'file') {
  CreateDirective.call(this, 'symlink', undefined, undefined);
  this.skipable = false;
  this.target = target;
  this.symlinkType = symlinkType;

}

SymlinkDirective.prototype.$symlinkType = function(symlinkType) {
  this.symlinkType = symlinkType;
  return this;
}

SymlinkDirective.prototype.$target = function(target) {
  this.target = target;
  return this;
}

SymlinkDirective.prototype.exec = async function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, true);
  await mkdirWhenNotExists(pathutils.dirname(path));
  await fsp.symlink(this.target, path, this.symlinkType);
}

/** Directive to create hardlink inside the base directory */
function HardLinkDirective(target) {
  CreateDirective.call(this, 'hardlink', undefined, undefined);
  this.skipable = true;
  this.target = target;
}

HardLinkDirective.prototype.$target = function(target) {
  this.target = target;
  return this;
}

HardLinkDirective.prototype.exec = async function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, false);
  const target = joinFilePath(basePath, this.target, false);
  await mkdirWhenNotExists(pathutils.dirname(path));
  await fsp.link(target, path);
}

/** Helper function to create CustomDirective */
export function custom(func) {
  return new CustomDirective(func);
}

/** Helper function to create LazyDirective */
export function lazy(func) {
  return new LazyDirective(func);
}

/** Helper function to create MoveDirective */
export function move(from, to) {
  return new MoveDirective(from, to);
}

/** Helper function to create CopyDirective */
export function copy(from, to) {
  return new CopyDirective(from, to);
}

/** Helper function to create FileDirective */
export function file() {
  return new FileDirective();
}

/** Helper function to create DirectoryDirective */
export function dir(files) {
  return new DirectoryDirective(files);
}

/** Helper function to create SymlinkDirective */
export function symlink(target, symlinkType) {
  return new SymlinkDirective(target, symlinkType);
}

/** Helper function to create HardLinkDirective */
export function link(target) {
  return new HardLinkDirective(target);
}

/** Create directories and files based on object mappings between filenames and directives */
export async function mkdirx(basePath, files, options = {}) {
  if (typeof basePath !== 'string' || !basePath || !isRegularObject(files) || !isRegularObject(options)) {
    throw new Error('Invalid arguments given');
  } else if (fs.existsSync(basePath) && !options.force) {
    throw new Error(`${basePath} directory already exists`);
  }

  const tmpFiles = Object.assign({}, files);
  for (const pathsSymbol of Object.getOwnPropertySymbols(files)) {
    const fileInfo = files[pathsSymbol];
    if (!pathsList[pathsSymbol]) {
      throw new Error('');
    }

    for (const fileName of pathsList[pathsSymbol]) {
      if (tmpFiles[fileName]) {
        throw new Error('');
      }
      tmpFiles[fileName] = fileInfo;
    }
    delete tmpFiles[pathsSymbol];
    delete pathsList[pathsSymbol];
  }

  await mkdirWhenNotExists(basePath);
  const executePromises = [];
  for (const filePath of Object.keys(tmpFiles)) {
    const fileDirective = tmpFiles[filePath];
    if (typeof fileDirective.$type !== 'string' && typeof fileDirective.exec !== 'function') {
      throw new Error('');
    }

    if (fileDirective.skipable) {
      executePromises.push(fileDirective.exec(basePath, filePath, options));
    } else {
      await fileDirective.exec(basePath, filePath, options);
    }
  }
  await Promise.all(executePromises);
}

mkdirx.custom = custom;
mkdirx.lazy = lazy;
mkdirx.move = move;
mkdirx.copy = copy;
mkdirx.file = file;
mkdirx.dir = dir;
mkdirx.symlink = symlink;
mkdirx.link = link;

export default mkdirx;
