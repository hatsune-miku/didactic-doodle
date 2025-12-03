use std::io::Error;

use crate::utils::lark::lark::Lark;

pub trait LarkFinder {
    fn locate(&mut self) -> Result<String, Error>;
}

impl LarkFinder for Lark {
    fn locate(&mut self) -> Result<String, Error> {
        match self.get_path() {
            Some(path) => Ok(path),
            None => {
                let path = String::from("asd");
                self.set_path(&path);
                Ok(path)
            }
        }
    }
}
