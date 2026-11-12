#!/usr/bin/env python3
"""Manual, reversible macOS Feishu probe. No launch/quit or user-data operations."""

import argparse
import copy
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import stat
import struct
import subprocess
import sys
import uuid


DEFAULT_APP = Path('/Applications/Lark.app')
DEFAULT_STATE = Path.home() / 'Library/Application Support/WAL/macos-probe'
MARKER = b'WAL_MACOS_PROBE_V1'
PAYLOAD = b'''
;(() => {
  // WAL_MACOS_PROBE_V1
  if (typeof document === 'undefined') return;
  function mount() {
    if (!document.body || document.getElementById('wal-macos-probe')) return;
    const badge = document.createElement('div');
    badge.id = 'wal-macos-probe';
    badge.textContent = 'WAL macOS TEST';
    badge.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;'
      + 'background:#a90070;color:white;padding:8px 12px;border-radius:8px;'
      + 'font:13px sans-serif;pointer-events:none;box-shadow:0 2px 12px #0004';
    document.body.appendChild(badge);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
'''


class ProbeError(Exception):
    pass


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def save_json(path, data):
    path = Path(path)
    temporary = path.with_name(path.name + '.tmp')
    with temporary.open('w', encoding='utf-8') as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def raise_walk_error(error):
    raise error


def snapshot(root):
    """Hash ordinary files and record symlinks without following them."""
    root = Path(root)
    entries = {'.': {'directory': True, 'mode': stat.S_IMODE(root.stat().st_mode)}}
    for directory, directories, files in os.walk(root, followlinks=False, onerror=raise_walk_error):
        for name in sorted(directories + files):
            path = Path(directory) / name
            relative = path.relative_to(root).as_posix()
            mode = stat.S_IMODE(path.lstat().st_mode)
            if path.is_symlink():
                entries[relative] = {'link': os.readlink(path)}
            elif path.is_dir():
                entries[relative] = {'directory': True, 'mode': mode}
            elif path.is_file():
                entries[relative] = {'sha256': digest(path), 'size': path.stat().st_size, 'mode': mode}
            else:
                raise ProbeError('应用包含不支持的文件类型: ' + relative)
    return entries


def verify_snapshot(root, expected):
    actual = snapshot(root)
    if actual != expected:
        changed = sorted(key for key in set(actual) | set(expected) if actual.get(key) != expected.get(key))
        raise ProbeError('文件校验失败: ' + ', '.join(changed[:8]))


def run(args, elevated=False, check=True):
    command = (['/usr/bin/sudo'] if elevated else []) + [str(arg) for arg in args]
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise ProbeError(result.stderr.strip() or result.stdout.strip() or '命令执行失败: ' + command[0])
    return result


def signature(path):
    result = run(['/usr/bin/codesign', '--verify', '--deep', '--strict', path], check=False)
    details = run(['/usr/bin/codesign', '-dv', '--verbose=2', path], check=False)
    return {'valid': result.returncode == 0, 'verification': result.stderr.strip(), 'details': details.stderr.strip()}


def require_signature(path):
    result = signature(path)
    if not result['valid']:
        raise ProbeError('原包签名未通过校验: ' + result['verification'])
    return result


def running_pids(app):
    # comm contains the executable path, without chat-related process arguments.
    output = run(['/bin/ps', '-axo', 'pid=,comm=']).stdout
    prefix = str(Path(app).resolve()) + '/'
    return [int(match.group(1)) for line in output.splitlines()
            if (match := re.match(r'\s*(\d+)\s+(.+)', line)) and match.group(2).startswith(prefix)]


def require_stopped(app):
    pids = running_pids(app)
    if pids:
        raise ProbeError('飞书仍在运行。请完全退出飞书后重试。PID: ' + ', '.join(map(str, pids)))


def app_info(app):
    path = Path(app) / 'Contents/Info.plist'
    with path.open('rb') as stream:
        info = plistlib.load(stream)
    if info.get('CFBundleIdentifier') != 'com.electron.lark':
        raise ProbeError('目标不是预期的飞书应用: ' + str(app))
    return {key: info.get(key) for key in ('CFBundleIdentifier', 'CFBundleShortVersionString', 'CFBundleVersion')}


def locate_archive(app):
    framework = app / 'Contents/Frameworks/Lark Framework.framework/Versions/Current'
    framework = framework.resolve(strict=True)
    try:
        framework.relative_to(app)
    except ValueError:
        raise ProbeError('Framework 链接指向应用包之外')
    archive = framework / 'Resources/webcontent/messenger.asar'
    if not archive.is_file() or archive.is_symlink():
        raise ProbeError('未找到 messenger.asar；该版本需要重新确认补丁目标')
    return archive


def read_asar(path):
    with Path(path).open('rb') as stream:
        prefix = stream.read(16)
        if len(prefix) != 16:
            raise ProbeError('ASAR 文件头不完整')
        magic, header_size, payload_size, json_size = struct.unpack('<4I', prefix)
        if magic != 4 or header_size != payload_size + 4 or json_size > payload_size - 4:
            raise ProbeError('不支持的 ASAR 文件头')
        if not 0 < json_size < 64 * 1024 * 1024 or header_size + 8 > Path(path).stat().st_size:
            raise ProbeError('ASAR 文件头长度异常')
        header = json.loads(stream.read(json_size))
    return header, header_size + 8


def encode_header(header):
    raw = json.dumps(header, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    padding = b'\0' * (-len(raw) % 4)
    payload = struct.pack('<I', len(raw)) + raw + padding
    return struct.pack('<III', 4, len(payload) + 4, len(payload)) + payload


def read_entry(source, data_offset, entry):
    start, length = int(entry['offset']), int(entry['size'])
    data_size = Path(source).stat().st_size - data_offset
    if start < 0 or length < 0 or start + length > data_size:
        raise ProbeError('ASAR 文件范围异常')
    with Path(source).open('rb') as stream:
        stream.seek(data_offset + start)
        return stream.read(length)


def select_script(source, header, data_offset):
    # Recent Feishu versions split messenger into many chunks. Its shared runtime
    # is a unique script explicitly referenced by the messenger HTML entry point.
    for subject in ('runtime~messenger', 'messenger'):
        files = header.get('files', {}).get(subject, {}).get('files', {})
        targets = [name for name, entry in files.items()
                   if name.endswith('.js') and 'offset' in entry and not entry.get('unpacked')]
        if not targets:
            continue
        if len(targets) != 1:
            raise ProbeError(subject + ' 目录中没有唯一的脚本，停止以免选错文件')
        name = targets[0]
        if subject == 'runtime~messenger':
            pages = header['files'].get('messenger', {}).get('files', {})
            references = [entry for key, entry in pages.items() if key.endswith('.html') and 'offset' in entry]
            needle = (subject + '/' + name).encode()
            if not any(needle in read_entry(source, data_offset, entry) for entry in references):
                raise ProbeError('消息页未引用该 runtime，停止以免修改无效目标')
        return subject + '/' + name, files[name]
    raise ProbeError('未找到可确认的消息页脚本；该版本需要重新定位入口')


def patch_archive(source, destination):
    """Append one JS body; keep all other bytes, offsets and header metadata."""
    header, offset = read_asar(source)
    target, entry = select_script(source, header, offset)
    data_size = Path(source).stat().st_size - offset
    original = read_entry(source, offset, entry)
    if MARKER in original:
        raise ProbeError('该脚本已经包含验证标记，请先恢复原包')
    patched = original + PAYLOAD
    integrity = entry.get('integrity')
    if integrity:
        if integrity.get('algorithm') != 'SHA256':
            raise ProbeError('不支持的 ASAR 完整性算法')
        block_size = int(integrity.get('blockSize', 0))
        if block_size <= 0:
            raise ProbeError('ASAR 完整性块大小异常')
        integrity['hash'] = hashlib.sha256(patched).hexdigest()
        integrity['blocks'] = [hashlib.sha256(patched[index:index + block_size]).hexdigest()
                               for index in range(0, len(patched), block_size)]
    entry['offset'] = str(data_size)
    entry['size'] = len(patched)
    with Path(destination).open('xb') as output, Path(source).open('rb') as original_file:
        output.write(encode_header(header))
        original_file.seek(offset)
        shutil.copyfileobj(original_file, output)
        output.write(patched)
        output.flush()
        os.fsync(output.fileno())
    return target


def signing_targets(app):
    """Discover real code paths; sign leaves before their enclosing bundles."""
    targets = {app}
    magic = {b'\xfe\xed\xfa\xce', b'\xce\xfa\xed\xfe', b'\xfe\xed\xfa\xcf',
             b'\xcf\xfa\xed\xfe', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca',
             b'\xca\xfe\xba\xbf', b'\xbf\xba\xfe\xca'}
    for directory, directories, files in os.walk(app, followlinks=False, onerror=raise_walk_error):
        base = Path(directory)
        if '_CodeSignature' in directories:
            targets.add(base.parent if base.name == 'Contents' else base)
        for name in files:
            path = base / name
            if path.is_symlink():
                continue
            with path.open('rb') as stream:
                is_code = stream.read(4) in magic
            if is_code and run(['/usr/bin/codesign', '-d', path], check=False).returncode == 0:
                targets.add(path)
    return sorted(targets, key=lambda path: (-len(path.parts), str(path)))


class Probe:
    def __init__(self, app, root):
        self.app = Path(app).expanduser().resolve()
        self.root = Path(root).expanduser().resolve()
        if self.root == self.app or self.app in self.root.parents:
            raise ProbeError('备份目录必须位于飞书应用包之外')
        self.session = None
        self.state = None
        self.elevated = False

    def load(self):
        current = json.loads((self.root / 'current.json').read_text())['session']
        if not re.fullmatch(r'\d{8}T\d{6}-[0-9a-f]{8}', current):
            raise ProbeError('备份索引无效')
        self.session = self.root / current
        if self.session.is_symlink():
            raise ProbeError('备份目录不可为符号链接')
        self.state = json.loads((self.session / 'state.json').read_text())
        if self.state['app'] != str(self.app):
            raise ProbeError('备份对应另一个应用路径')
        return self.state

    def save(self, phase=None):
        if phase:
            self.state['phase'] = phase
        save_json(self.session / 'state.json', self.state)

    def privileges(self):
        # Only elevate subprocesses that modify the app. Keep the controller and
        # recovery state owned by the login user, even when /Applications is locked.
        self.elevated = not os.access(self.app.parent, os.W_OK)
        for directory, _, files in os.walk(self.app, followlinks=False):
            if not os.access(directory, os.W_OK):
                self.elevated = True
                break
            if any(not os.access(Path(directory) / name, os.W_OK) for name in files):
                self.elevated = True
                break
        if self.elevated:
            print('写入应用需要管理员权限，请在终端输入密码。', flush=True)
            subprocess.run(['/usr/bin/sudo', '-v'], check=True)

    def copy_bundle(self, source, destination, elevated=False):
        run(['/usr/bin/ditto', '--rsrc', '--extattr', '--acl', source, destination], elevated=elevated)

    def check_version(self):
        if app_info(self.app) != self.state['info']:
            raise ProbeError('飞书版本已改变；保留备份并停止，避免覆盖新版本')
        if digest(self.app / 'Contents/Info.plist') != self.state['info_sha256']:
            raise ProbeError('Info.plist 已改变；停止覆盖，请先核对客户端更新')

    def check(self):
        info = app_info(self.app)
        archive = locate_archive(self.app)
        header, offset = read_asar(archive)
        target, _ = select_script(archive, header, offset)
        report = {'app': str(self.app), 'info': info, 'archive': str(archive),
                  'target': target,
                  'running_pids': running_pids(self.app), 'signature': signature(self.app),
                  'free_bytes': shutil.disk_usage(self.app.parent).free}
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return report

    def apply(self):
        require_stopped(self.app)
        info = app_info(self.app)
        if (self.root / 'current.json').exists() and self.load()['phase'] not in ('restored', 'backing-up', 'prepared'):
            raise ProbeError('已有未恢复的验证，请先执行 restore')
        original_signature = require_signature(self.app)
        archive = locate_archive(self.app)
        header, offset = read_asar(archive)
        select_script(archive, header, offset)
        print('正在校验原包并建立完整备份…', flush=True)
        baseline = snapshot(self.app)
        size = sum(item.get('size', 0) for item in baseline.values())
        needed = 2 * size + 2 * archive.stat().st_size
        if min(shutil.disk_usage(self.root).free, shutil.disk_usage(self.app.parent).free) < needed:
            raise ProbeError('备份与恢复至少需要约 %.1f GB 可用空间' % (needed / 1e9))
        session_id = datetime.datetime.now().strftime('%Y%m%dT%H%M%S-') + uuid.uuid4().hex[:8]
        self.session = self.root / session_id
        self.session.mkdir(mode=0o700)
        self.state = {'app': str(self.app), 'info': info, 'info_sha256': digest(self.app / 'Contents/Info.plist'),
                      'phase': 'backing-up', 'archive': archive.relative_to(self.app).as_posix(),
                      'original_signature': original_signature}
        self.save()
        save_json(self.session / 'original-files.json', baseline)
        save_json(self.root / 'current.json', {'session': session_id})
        self.copy_bundle(self.app, self.session / 'original.app')
        verify_snapshot(self.session / 'original.app', baseline)
        require_signature(self.session / 'original.app')
        require_stopped(self.app)
        verify_snapshot(self.app, baseline)
        self.save('prepared')

        patched = self.session / 'patched.asar'
        target = patch_archive(self.session / 'original.app' / self.state['archive'], patched)
        self.state.update({'target': target, 'patched_sha256': digest(patched)})
        self.save()
        self.privileges()
        require_stopped(self.app)
        self.check_version()
        if digest(archive) != baseline[self.state['archive']]['sha256']:
            raise ProbeError('备份后资源已改变，停止覆盖；请核对飞书更新')
        stage = archive.with_name('.wal-probe-' + session_id + '.tmp')
        if stage.exists() or stage.is_symlink():
            raise ProbeError('暂存文件已存在，停止覆盖')
        self.state['stage_file'] = stage.relative_to(self.app).as_posix()
        self.save('patching')
        metadata = archive.stat()
        mode = stat.S_IMODE(metadata.st_mode)
        run(['/usr/bin/install', '-m', oct(mode)[2:], '-o', metadata.st_uid, '-g', metadata.st_gid,
             patched, stage], elevated=self.elevated)
        require_stopped(self.app)
        run(['/bin/mv', '-f', stage, archive], elevated=self.elevated)
        if digest(archive) != self.state['patched_sha256']:
            raise ProbeError('补丁写入校验失败，请执行 restore')
        self.state['patched_signature'] = signature(self.app)
        self.save('patched')
        print('补丁已写入。现在可手动打开飞书，在消息页检查右下角 WAL macOS TEST 标记。')
        print('本阶段保留原签名，资源签名校验失败是预期结果；启动结果需实际观察。')

    def resign(self):
        self.load()
        if self.state['phase'] not in ('patched', 'resigning', 'resigned'):
            raise ProbeError('请先完成 apply')
        require_stopped(self.app)
        self.check_version()
        if digest(self.app / self.state['archive']) != self.state['patched_sha256']:
            raise ProbeError('验证资源已改变，停止重签；请核对飞书更新')
        verify_snapshot(self.session / 'original.app', json.loads((self.session / 'original-files.json').read_text()))
        self.privileges()
        targets = signing_targets(self.app)
        self.state['signing_targets'] = [path.relative_to(self.app).as_posix() for path in targets]
        self.save('resigning')
        for index, target in enumerate(targets, 1):
            require_stopped(self.app)
            print('临时签名 %d/%d: %s' % (index, len(targets), target.relative_to(self.app)), flush=True)
            run(['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none',
                 '--preserve-metadata=identifier,entitlements,flags,runtime', target], elevated=self.elevated)
        self.state['resigned_signature'] = signature(self.app)
        self.save('resigned')
        if not self.state['resigned_signature']['valid']:
            raise ProbeError('临时签名未通过校验，请执行 report 后 restore')
        print('临时签名校验通过。请手动启动飞书，检查标记、已有登录态和正常页面访问。')

    def restore(self):
        self.load()
        require_stopped(self.app)
        original = self.session / 'original.app'
        baseline = json.loads((self.session / 'original-files.json').read_text())
        verify_snapshot(original, baseline)
        require_signature(original)
        if self.app.exists():
            self.check_version()
        self.privileges()
        token = self.session.name
        staged = self.app.parent / ('.wal-restore-' + token + '.app')
        displaced = self.app.parent / ('.wal-tested-' + token + '.app')
        if staged.is_symlink() or displaced.is_symlink():
            raise ProbeError('恢复暂存路径不可为符号链接')
        if self.state['phase'] == 'restored':
            verify_snapshot(self.app, baseline)
            require_signature(self.app)
            self.keep_tested_bundle(displaced)
            print('原包已经恢复，校验通过。')
            return
        # Recover an interruption after the restored bundle reached its final path.
        if self.state['phase'] == 'restoring' and self.app.exists() and displaced.exists():
            verify_snapshot(self.app, baseline)
            self.state['restored_signature'] = require_signature(self.app)
            self.save('restored')
            self.keep_tested_bundle(displaced)
            print('已完成上次中断的恢复，原包校验通过。')
            return
        # Recopy incomplete staging after an interrupted ditto operation.
        self.copy_bundle(original, staged, elevated=self.elevated)
        verify_snapshot(staged, baseline)
        require_signature(staged)
        require_stopped(self.app)
        self.save('restoring')
        try:
            if self.app.exists():
                if displaced.exists():
                    raise ProbeError('恢复暂存目录已存在，保留所有副本并停止')
                run(['/bin/mv', self.app, displaced], elevated=self.elevated)
            run(['/bin/mv', staged, self.app], elevated=self.elevated)
        except BaseException:
            if not self.app.exists() and displaced.exists():
                run(['/bin/mv', displaced, self.app], elevated=self.elevated)
            raise
        verify_snapshot(self.app, baseline)
        self.state['restored_signature'] = require_signature(self.app)
        self.save('restored')
        self.keep_tested_bundle(displaced)
        print('原应用、文件权限和原签名已恢复并通过校验。可以正常打开飞书。')

    def keep_tested_bundle(self, displaced):
        if displaced.exists():
            destination = self.session / 'tested.app'
            if destination.exists() or destination.is_symlink():
                raise ProbeError('原包已恢复，但 tested.app 已存在；保留恢复暂存目录供核对')
            run(['/bin/mv', displaced, destination], elevated=self.elevated)

    def report(self):
        self.load()
        report = copy.deepcopy(self.state)
        report['running_pids'] = running_pids(self.app)
        report['current_signature'] = signature(self.app) if self.app.exists() else None
        report['app_exists'] = self.app.exists()
        destination = self.session / 'report.json'
        save_json(destination, report)
        print('报告: ' + str(destination))
        print('阶段: ' + report['phase'])


def main():
    parser = argparse.ArgumentParser(description='飞书 macOS 手动验证；默认只检查，不启动或结束飞书')
    parser.add_argument('action', nargs='?', default='check', choices=['check', 'apply', 'resign', 'restore', 'report'])
    parser.add_argument('--app', type=Path, default=DEFAULT_APP)
    parser.add_argument('--state-dir', type=Path, default=DEFAULT_STATE)
    args = parser.parse_args()
    if sys.platform != 'darwin':
        parser.error('此脚本仅用于 macOS')
    if os.geteuid() == 0:
        parser.error('请以普通用户运行；脚本会在必要时单独申请 sudo')
    try:
        probe = Probe(args.app, args.state_dir)
        if args.action == 'check':
            probe.check()
            return 0
        probe.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (probe.root / 'probe.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            getattr(probe, args.action)()
        print('备份目录: ' + str(probe.session))
        return 0
    except (OSError, ValueError, KeyError, ProbeError, subprocess.SubprocessError, KeyboardInterrupt) as error:
        print('停止: ' + str(error), file=sys.stderr)
        print('若已应用补丁，可在退出飞书后执行同一脚本的 restore 命令。', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
