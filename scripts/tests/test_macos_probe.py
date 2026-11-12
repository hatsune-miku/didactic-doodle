import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location('macos_probe', Path(__file__).resolve().parents[1] / 'macos_probe.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


def make_archive(path, scripts=None):
    scripts = scripts or {'main.js': b'"use strict";console.log("original");\n//# sourceMappingURL=main.js.map'}
    data = b''
    entries = {}
    for name, content in scripts.items():
        entries[name] = {
            'offset': str(len(data)), 'size': len(content),
            'integrity': {'algorithm': 'SHA256', 'hash': hashlib.sha256(content).hexdigest(), 'blockSize': 8,
                          'blocks': [hashlib.sha256(content[index:index + 8]).hexdigest()
                                     for index in range(0, len(content), 8)]},
        }
        data += content
    header = {'files': {'messenger': {'files': entries},
                        'other.bin': {'offset': str(len(data)), 'size': 4, 'executable': True},
                        'alias': {'link': 'other.bin'}, 'external.node': {'size': 9, 'unpacked': True}}}
    data += b'\0\1\2\3'
    # Independent pickle encoding, matching Chromium's ASAR wire format.
    raw = json.dumps(header).encode()
    padded = (len(raw) + 3) // 4 * 4
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack('<4I', 4, padded + 8, padded + 4, len(raw)) + raw + b'\0' * (padded - len(raw)) + data)
    return header, data


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='wal-probe-unit-')
        self.root = Path(self.temporary.name)
        self.source = self.root / 'original.asar'
        self.destination = self.root / 'patched.asar'

    def tearDown(self):
        self.temporary.cleanup()

    def test_only_selected_script_changes_and_integrity_is_recalculated(self):
        original_header, original_data = make_archive(self.source)
        original_hash = probe.digest(self.source)
        target = probe.patch_archive(self.source, self.destination)
        header, offset = probe.read_asar(self.destination)
        entry = header['files']['messenger']['files']['main.js']
        data = self.destination.read_bytes()[offset:]
        changed = data[int(entry['offset']):int(entry['offset']) + entry['size']]
        self.assertEqual(target, 'messenger/main.js')
        self.assertEqual(probe.digest(self.source), original_hash)
        self.assertEqual(data[:len(original_data)], original_data)
        self.assertIn(probe.MARKER, changed)
        self.assertEqual(entry['integrity']['hash'], hashlib.sha256(changed).hexdigest())
        self.assertEqual(entry['integrity']['blocks'], [hashlib.sha256(changed[i:i + 8]).hexdigest()
                                                      for i in range(0, len(changed), 8)])
        restored_header = copy.deepcopy(header)
        restored_header['files']['messenger'] = original_header['files']['messenger']
        self.assertEqual(restored_header, original_header)

    def test_ambiguous_script_is_rejected_before_output_is_written(self):
        make_archive(self.source, {'one.js': b'one', 'two.js': b'two'})
        with self.assertRaises(probe.ProbeError):
            probe.patch_archive(self.source, self.destination)
        self.assertFalse(self.destination.exists())

    def test_second_patch_is_rejected(self):
        make_archive(self.source)
        probe.patch_archive(self.source, self.destination)
        with self.assertRaises(probe.ProbeError):
            probe.patch_archive(self.destination, self.root / 'second.asar')

    def test_chunked_messenger_uses_the_runtime_referenced_by_its_html(self):
        make_archive(self.source)
        header, offset = probe.read_asar(self.source)
        data = self.source.read_bytes()[offset:]
        header['files']['runtime~messenger'] = header['files'].pop('messenger')
        html = b'<script src="native-resource://sandbox_fs/webcontent/messenger/runtime~messenger/main.js"></script>'
        header['files']['messenger'] = {'files': {'zh-CN.html': {'offset': str(len(data)), 'size': len(html)}}}
        self.source.write_bytes(probe.encode_header(header) + data + html)

        target = probe.patch_archive(self.source, self.destination)
        self.assertEqual(target, 'runtime~messenger/main.js')

    def test_unreferenced_runtime_is_rejected(self):
        make_archive(self.source)
        header, offset = probe.read_asar(self.source)
        data = self.source.read_bytes()[offset:]
        header['files']['runtime~messenger'] = header['files'].pop('messenger')
        self.source.write_bytes(probe.encode_header(header) + data)
        with self.assertRaises(probe.ProbeError):
            probe.patch_archive(self.source, self.destination)

    def test_truncated_and_invalid_headers_are_rejected(self):
        for content in [b'bad', struct.pack('<4I', 4, 1000, 996, 992), struct.pack('<4I', 4, 8, 9, 4)]:
            self.source.write_bytes(content)
            with self.assertRaises(probe.ProbeError):
                probe.read_asar(self.source)

    def test_backup_cannot_be_inside_application(self):
        with self.assertRaises(probe.ProbeError):
            probe.Probe(self.root / 'Lark.app', self.root / 'Lark.app/backup')

    def test_active_application_is_rejected_before_any_backup_or_signature_work(self):
        controller = probe.Probe(self.root / 'Lark.app', self.root / 'state')
        with patch.object(probe, 'running_pids', return_value=[123]), patch.object(probe, 'signature') as sign:
            with self.assertRaises(probe.ProbeError):
                controller.apply()
        sign.assert_not_called()
        self.assertFalse(controller.root.exists())


@unittest.skipUnless(sys.platform == 'darwin' and Path('/usr/bin/clang').exists(), 'requires macOS tools')
class SignedBundleTests(unittest.TestCase):
    """Exercise real ditto/codesign/mv on a tiny synthetic app, never installed Feishu."""

    @classmethod
    def setUpClass(cls):
        cls.template_dir = tempfile.TemporaryDirectory(prefix='wal-probe-signed-fixture-')
        cls.template = Path(cls.template_dir.name) / 'Lark.app'
        contents = cls.template / 'Contents'
        (contents / 'MacOS').mkdir(parents=True)
        info = {'CFBundleIdentifier': 'com.electron.lark', 'CFBundleExecutable': 'Feishu',
                'CFBundlePackageType': 'APPL', 'CFBundleVersion': '1', 'CFBundleShortVersionString': '1.0'}
        (contents / 'Info.plist').write_bytes(plistlib.dumps(info))
        subprocess.run(['/usr/bin/clang', '-x', 'c', '-', '-o', str(contents / 'MacOS/Feishu')],
                       input='int main(void) { return 0; }', text=True, check=True, capture_output=True)
        framework = contents / 'Frameworks/Lark Framework.framework'
        version = framework / 'Versions/A'
        resources = version / 'Resources'
        resources.mkdir(parents=True)
        os.symlink('A', framework / 'Versions/Current')
        os.symlink('Versions/Current/Resources', framework / 'Resources')
        os.symlink('Versions/Current/Lark Framework', framework / 'Lark Framework')
        (resources / 'Info.plist').write_bytes(plistlib.dumps({
            'CFBundleIdentifier': 'org.example.wal-probe-framework', 'CFBundleExecutable': 'Lark Framework',
            'CFBundlePackageType': 'FMWK', 'CFBundleVersion': '1',
        }))
        subprocess.run(['/usr/bin/clang', '-dynamiclib', '-x', 'c', '-', '-o', str(version / 'Lark Framework')],
                       input='int wal_probe_fixture(void) { return 1; }', text=True, check=True, capture_output=True)
        make_archive(resources / 'webcontent/messenger.asar')
        for target in [version, cls.template]:
            probe.run(['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none', target])
        probe.require_signature(cls.template)

    @classmethod
    def tearDownClass(cls):
        cls.template_dir.cleanup()

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='wal-probe-integration-')
        self.root = Path(self.temporary.name)
        self.app = self.root / 'Installed Lark.app'
        self.state = self.root / 'state'
        self.state.mkdir()
        self.controller = probe.Probe(self.app, self.state)
        self.controller.copy_bundle(self.template, self.app)
        self.original = probe.snapshot(self.app)

    def tearDown(self):
        self.temporary.cleanup()

    def test_real_apply_resign_restore_cycle_preserves_original_bytes_and_signature(self):
        self.controller.apply()
        self.assertFalse(probe.signature(self.app)['valid'])
        self.controller.resign()
        self.assertTrue(probe.signature(self.app)['valid'])
        self.controller.restore()
        self.assertEqual(probe.snapshot(self.app), self.original)
        self.assertTrue(probe.signature(self.app)['valid'])
        self.assertTrue((self.controller.session / 'tested.app').is_dir())
        self.controller.restore()  # Recovery is idempotent.

    def test_running_process_prevents_resigning_and_restoring(self):
        self.controller.apply()
        before = probe.snapshot(self.app)
        with patch.object(probe, 'running_pids', return_value=[321]):
            for action in [self.controller.resign, self.controller.restore]:
                with self.assertRaises(probe.ProbeError):
                    action()
        self.assertEqual(probe.snapshot(self.app), before)

    def test_corrupted_backup_cannot_replace_installed_application(self):
        self.controller.apply()
        before = probe.snapshot(self.app)
        backup_archive = probe.locate_archive(self.controller.session / 'original.app')
        backup_archive.write_bytes(b'corrupted')
        with self.assertRaises(probe.ProbeError):
            self.controller.restore()
        self.assertEqual(probe.snapshot(self.app), before)

    def test_updated_application_is_not_downgraded(self):
        self.controller.apply()
        info_path = self.app / 'Contents/Info.plist'
        info = plistlib.loads(info_path.read_bytes())
        info['CFBundleVersion'] = '2'
        info_path.write_bytes(plistlib.dumps(info))
        with self.assertRaises(probe.ProbeError):
            self.controller.restore()
        self.assertEqual(plistlib.loads(info_path.read_bytes())['CFBundleVersion'], '2')

    def test_interrupted_backup_can_be_retried_without_modifying_original(self):
        with patch.object(self.controller, 'copy_bundle', side_effect=probe.ProbeError('copy interrupted')):
            with self.assertRaises(probe.ProbeError):
                self.controller.apply()
        self.assertEqual(probe.snapshot(self.app), self.original)
        self.controller.apply()
        self.assertEqual(self.controller.state['phase'], 'patched')

    def test_failed_swap_rolls_back_the_installed_path_and_can_be_retried(self):
        self.controller.apply()
        modified = probe.snapshot(self.app)
        original_run = probe.run

        def fail_install(args, **kwargs):
            if str(args[0]) == '/bin/mv' and Path(args[1]).name.startswith('.wal-restore-'):
                raise probe.ProbeError('simulated move failure')
            return original_run(args, **kwargs)

        with patch.object(probe, 'run', side_effect=fail_install):
            with self.assertRaises(probe.ProbeError):
                self.controller.restore()
        self.assertEqual(probe.snapshot(self.app), modified)
        self.controller.restore()
        self.assertEqual(probe.snapshot(self.app), self.original)

    def test_resume_after_interruption_between_the_two_renames(self):
        self.controller.apply()
        displaced = self.app.parent / ('.wal-tested-' + self.controller.session.name + '.app')
        self.app.rename(displaced)
        self.controller.save('restoring')
        self.controller.restore()
        self.assertEqual(probe.snapshot(self.app), self.original)

    def test_resume_after_swap_before_recording_success(self):
        self.controller.apply()
        displaced = self.app.parent / ('.wal-tested-' + self.controller.session.name + '.app')
        self.app.rename(displaced)
        self.controller.copy_bundle(self.controller.session / 'original.app', self.app)
        self.controller.save('restoring')
        self.controller.restore()
        self.assertEqual(self.controller.state['phase'], 'restored')
        self.assertTrue((self.controller.session / 'tested.app').exists())

    def test_incomplete_restore_staging_is_repaired(self):
        self.controller.apply()
        staged = self.app.parent / ('.wal-restore-' + self.controller.session.name + '.app')
        (staged / 'Contents').mkdir(parents=True)
        (staged / 'Contents/Info.plist').write_bytes(b'incomplete')
        self.controller.restore()
        self.assertEqual(probe.snapshot(self.app), self.original)


if __name__ == '__main__':
    unittest.main()
