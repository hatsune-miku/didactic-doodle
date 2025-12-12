use std::sync::{LazyLock, Mutex};

use crate::error::{WalError, WalResult};

pub type LogSubscriber = Box<dyn Fn(String) + Send + Sync>;

static SUBSCRIBERS: LazyLock<Mutex<Vec<LogSubscriber>>> = LazyLock::new(|| {
    Mutex::new(vec![Box::new(|message| {
        println!("{}", message);
    })])
});

pub fn subscribe_log(subscriber: LogSubscriber) -> WalResult<()> {
    SUBSCRIBERS
        .lock()
        .map_err(|_| WalError::LockError)?
        .push(subscriber);
    Ok(())
}

pub fn log(level: &str, message: &str) {
    let subscribers = SUBSCRIBERS.lock().unwrap();
    subscribers
        .iter()
        .for_each(|subscriber| subscriber(format!("{} {}", level.to_uppercase(), message)));
}

#[macro_export]
macro_rules! log {
    ($level:ident, $($arg:tt)*) => {
        crate::utils::log::logger::log(stringify!($level), &format!($($arg)*));
    };
}

#[macro_export]
macro_rules! verbose {
    ($($arg:tt)*) => {
        log!(VERBOSE, $($arg)*);
    };
}

#[macro_export]
macro_rules! debug {
    ($($arg:tt)*) => {
        log!(DEBUG, $($arg)*);
    };
}

#[macro_export]
macro_rules! info {
    ($($arg:tt)*) => {
        crate::utils::log::logger::log(stringify!(INFO), &format!($($arg)*));
    };
}
