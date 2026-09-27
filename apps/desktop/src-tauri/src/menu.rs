#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

#[cfg(test)]
pub const RESERVED_FOR_WEBVIEW: &[&str] = &[
    "CmdOrCtrl+W",
    "CmdOrCtrl+T",
    "CmdOrCtrl+K",
    "CmdOrCtrl+Shift+P",
    "CmdOrCtrl+1",
    "CmdOrCtrl+2",
    "CmdOrCtrl+3",
    "CmdOrCtrl+4",
    "CmdOrCtrl+5",
    "CmdOrCtrl+6",
    "CmdOrCtrl+7",
    "CmdOrCtrl+8",
    "CmdOrCtrl+9",
];

pub const CLOSE_WINDOW: &str = "close-window";

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Predefined {
    About,
    Services,
    Hide,
    HideOthers,
    ShowAll,
    Quit,
    Undo,
    Redo,
    Cut,
    Copy,
    Paste,
    SelectAll,
    Minimize,
    Maximize,
    Fullscreen,
}

impl Predefined {
    pub fn label(self) -> &'static str {
        match self {
            Predefined::About => "À propos de Kibo",
            Predefined::Services => "Services",
            Predefined::Hide => "Masquer Kibo",
            Predefined::HideOthers => "Masquer les autres",
            Predefined::ShowAll => "Tout afficher",
            Predefined::Quit => "Quitter Kibo",
            Predefined::Undo => "Annuler",
            Predefined::Redo => "Rétablir",
            Predefined::Cut => "Couper",
            Predefined::Copy => "Copier",
            Predefined::Paste => "Coller",
            Predefined::SelectAll => "Tout sélectionner",
            Predefined::Minimize => "Réduire",
            Predefined::Maximize => "Agrandir",
            Predefined::Fullscreen => "Plein écran",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Entry {
    Predefined(Predefined),
    Custom {
        id: &'static str,
        text: &'static str,
        accelerator: Option<&'static str>,
    },
    Separator,
}

pub const MENU: &[(&str, &[Entry])] = &[
    (
        "Kibo",
        &[
            Entry::Predefined(Predefined::About),
            Entry::Separator,
            Entry::Predefined(Predefined::Services),
            Entry::Separator,
            Entry::Predefined(Predefined::Hide),
            Entry::Predefined(Predefined::HideOthers),
            Entry::Predefined(Predefined::ShowAll),
            Entry::Separator,
            Entry::Predefined(Predefined::Quit),
        ],
    ),
    (
        "Édition",
        &[
            Entry::Predefined(Predefined::Undo),
            Entry::Predefined(Predefined::Redo),
            Entry::Separator,
            Entry::Predefined(Predefined::Cut),
            Entry::Predefined(Predefined::Copy),
            Entry::Predefined(Predefined::Paste),
            Entry::Predefined(Predefined::SelectAll),
        ],
    ),
    (
        "Fenêtre",
        &[
            Entry::Predefined(Predefined::Minimize),
            Entry::Predefined(Predefined::Maximize),
            Entry::Predefined(Predefined::Fullscreen),
            Entry::Separator,
            Entry::Custom {
                id: CLOSE_WINDOW,
                text: "Fermer la fenêtre",
                accelerator: Some("CmdOrCtrl+Shift+W"),
            },
        ],
    ),
];

#[cfg(test)]
pub fn accelerators(menu: &[(&str, &[Entry])]) -> Vec<&'static str> {
    menu.iter()
        .flat_map(|(_, entries)| entries.iter())
        .filter_map(|entry| match entry {
            Entry::Custom { accelerator, .. } => *accelerator,
            _ => None,
        })
        .collect()
}

#[cfg(target_os = "macos")]
mod native {
    use super::{Entry, Predefined, CLOSE_WINDOW, MENU};
    use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
    use tauri::{AppHandle, Manager, Wry};

    fn predefined(app: &AppHandle, item: Predefined) -> tauri::Result<PredefinedMenuItem<Wry>> {
        let text = Some(item.label());
        match item {
            Predefined::About => PredefinedMenuItem::about(app, text, None),
            Predefined::Services => PredefinedMenuItem::services(app, text),
            Predefined::Hide => PredefinedMenuItem::hide(app, text),
            Predefined::HideOthers => PredefinedMenuItem::hide_others(app, text),
            Predefined::ShowAll => PredefinedMenuItem::show_all(app, text),
            Predefined::Quit => PredefinedMenuItem::quit(app, text),
            Predefined::Undo => PredefinedMenuItem::undo(app, text),
            Predefined::Redo => PredefinedMenuItem::redo(app, text),
            Predefined::Cut => PredefinedMenuItem::cut(app, text),
            Predefined::Copy => PredefinedMenuItem::copy(app, text),
            Predefined::Paste => PredefinedMenuItem::paste(app, text),
            Predefined::SelectAll => PredefinedMenuItem::select_all(app, text),
            Predefined::Minimize => PredefinedMenuItem::minimize(app, text),
            Predefined::Maximize => PredefinedMenuItem::maximize(app, text),
            Predefined::Fullscreen => PredefinedMenuItem::fullscreen(app, text),
        }
    }

    fn item(app: &AppHandle, entry: &Entry) -> tauri::Result<Box<dyn IsMenuItem<Wry>>> {
        Ok(match entry {
            Entry::Predefined(p) => Box::new(predefined(app, *p)?),
            Entry::Separator => Box::new(PredefinedMenuItem::separator(app)?),
            Entry::Custom {
                id,
                text,
                accelerator,
            } => Box::new(MenuItem::with_id(app, *id, *text, true, *accelerator)?),
        })
    }

    pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
        let menu = Menu::new(app)?;
        for (title, entries) in MENU {
            let items = entries
                .iter()
                .map(|e| item(app, e))
                .collect::<tauri::Result<Vec<_>>>()?;
            let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|i| i.as_ref()).collect();
            menu.append(&Submenu::with_items(app, *title, true, &refs)?)?;
        }
        Ok(menu)
    }

    pub fn on_event(app: &AppHandle, id: &str) {
        if id != CLOSE_WINDOW {
            return;
        }
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        if let Err(e) = window.close() {
            eprintln!("[kibo] cannot close the main window: {e}");
        }
    }
}

#[cfg(target_os = "macos")]
pub use native::{build, on_event};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_leaves_tab_shortcuts_to_the_webview() {
        for accelerator in accelerators(MENU) {
            assert!(
                !RESERVED_FOR_WEBVIEW.contains(&accelerator),
                "{accelerator} belongs to the webview"
            );
        }
    }

    #[test]
    fn closing_the_window_takes_shift() {
        assert_eq!(accelerators(MENU), vec!["CmdOrCtrl+Shift+W"]);
    }

    #[test]
    fn menu_has_the_three_macos_submenus() {
        let titles: Vec<&str> = MENU.iter().map(|(title, _)| *title).collect();
        assert_eq!(titles, vec!["Kibo", "Édition", "Fenêtre"]);
    }
}
