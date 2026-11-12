use std::{
    path::Path,
    process::Command,
    thread,
    time::{Duration, Instant},
};

use super::checked_output;
use crate::error::{WalError, WalResult};

pub fn parse_pids(output: &str, app: &Path) -> Vec<u32> {
    let prefix = format!("{}/Contents/", app.display());
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            let index = line.find(char::is_whitespace)?;
            let (pid, command) = line.split_at(index);
            command
                .trim_start()
                .starts_with(&prefix)
                .then(|| pid.parse().ok())
                .flatten()
        })
        .collect()
}

pub fn running_pids(app: &Path) -> WalResult<Vec<u32>> {
    let app = app.canonicalize()?;
    let output = checked_output(Command::new("/bin/ps").args(["-axo", "pid=,comm="]))?;
    Ok(parse_pids(&String::from_utf8_lossy(&output.stdout), &app))
}

pub fn kill(app: &Path) -> WalResult<()> {
    for signal in ["-TERM", "-KILL"] {
        for pid in running_pids(app)? {
            // A process may exit between enumeration and signalling. Recheck below.
            let _ = Command::new("/bin/kill")
                .arg(signal)
                .arg(pid.to_string())
                .output()?;
        }
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline {
            if running_pids(app)?.is_empty() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(100));
        }
    }
    Err(WalError::Message("部分飞书进程未能结束".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_bundle_boundaries_and_helpers_without_reading_arguments() {
        let output = " 12 /Applications/飞书 测试.app/Contents/MacOS/Lark\n13 /Applications/飞书 测试.app/Contents/Frameworks/Helper.app/Contents/MacOS/Helper\n14 /Applications/飞书 测试.app.old/Contents/MacOS/Lark\n15 /Applications/Other.app/Contents/MacOS/Lark\n";
        assert_eq!(
            parse_pids(output, Path::new("/Applications/飞书 测试.app")),
            vec![12, 13]
        );
    }
}
