pub struct Lark {
    path: Option<String>,
}

impl Lark {
    pub fn new() -> Self {
        Self { path: None }
    }

    pub fn set_path(&mut self, path: &String) {
        self.path = Some(path.clone());
    }

    pub fn get_path(&self) -> Option<String> {
        self.path.clone()
    }
}
