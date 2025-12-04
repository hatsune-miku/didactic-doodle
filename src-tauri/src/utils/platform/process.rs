use std::{ffi::c_void, os::windows::raw::HANDLE};

use windows_sys::Win32::{
    Foundation::CloseHandle,
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
        Threading::{
            OpenProcess, TerminateProcess, WaitForMultipleObjects, INFINITE, PROCESS_ALL_ACCESS,
            PROCESS_SYNCHRONIZE,
        },
    },
};

use crate::utils::platform::os::wide_to_string_utf16;

pub fn enum_processes<F>(process_name: &str, mut callback: F) -> usize
where
    F: FnMut(&PROCESSENTRY32W) -> bool,
{
    let process_name = process_name.to_lowercase();
    let mut count: usize = 0;

    unsafe {
        let h_snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if h_snapshot.is_null() {
            return 0;
        }
        let mut pe32 = PROCESSENTRY32W::default();
        pe32.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let first = Process32FirstW(h_snapshot, &mut pe32);
        if first == 0 {
            CloseHandle(h_snapshot);
            return 0;
        }
        loop {
            let exe_file = wide_to_string_utf16(&pe32.szExeFile).to_lowercase();
            if process_name == exe_file {
                count += 1;
                if !callback(&pe32) {
                    break;
                }
            }
            if Process32NextW(h_snapshot, &mut pe32) == 0 {
                break;
            }
        }
        CloseHandle(h_snapshot);
    }
    count
}

pub fn is_process_running(process_name: &str) -> bool {
    enum_processes(process_name, |_| false) > 0
}

pub fn kill_all_processes(process_name: &str) -> bool {
    let mut all_killed = true;
    enum_processes(process_name, |pe32| unsafe {
        let h_process = OpenProcess(PROCESS_ALL_ACCESS, 0, pe32.th32ProcessID);
        if h_process.is_null() {
            all_killed = false;
            return true;
        }
        if TerminateProcess(h_process, 0) == 0 {
            all_killed = false;
            CloseHandle(h_process);
            return true;
        }
        CloseHandle(h_process);
        true
    });
    all_killed
}

pub async fn wait_until_all_processes_ended(process_name: &str) {
    let process_name = process_name.to_owned();
    let task = tokio::task::spawn_blocking(move || loop {
        let mut handles: Vec<HANDLE> = Vec::new();
        let count = enum_processes(&process_name, |pe32| {
            unsafe {
                let h_process = OpenProcess(PROCESS_SYNCHRONIZE, 0, pe32.th32ProcessID);
                handles.push(h_process);
            }
            true
        });
        if count == 0 {
            break;
        }
        unsafe {
            WaitForMultipleObjects(handles.len() as u32, handles.as_ptr(), 1, INFINITE);
            handles.iter().for_each(|h| {
                CloseHandle(*h as *mut c_void);
            });
        };
    });
    let _ = task.await;
}
